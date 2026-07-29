# Architecture : Codex Keizaal

Référence technique du projet. Décrit le découpage en modules, les flux de données et les conventions, pour que chaque évolution future trouve naturellement sa place.

---

## 1. Principes directeurs

1. **Style fonctionnel** : des fonctions pures et des modules, pas de classes ni de `this`. Un module = une responsabilité. Les données circulent sous forme d'objets JSON immuables (on retourne des copies, on ne mute pas les arguments).
2. **Les dépendances pointent vers l'intérieur** : `HTTP → service → repository → SQLite` côté serveur, `composant → store → api → HTTP` côté client. Une couche ne connaît jamais celle qui l'appelle.
3. **Le métier est indépendant du transport** : les services ne savent pas qu'HTTP existe (pas de `req`/`res`), les stores ne savent pas que `fetch` existe. On peut tester le métier sans serveur et sans navigateur.
4. **Une seule source de vérité par donnée** : la base pour les données persistées, le store pour l'état client, les modules `shared/` pour les règles communes (enums, schémas). Jamais deux copies divergentes d'une même règle.
5. **TypeScript partout** : front (`.ts`/`.vue` via Vite) et serveur (`.ts` exécutés nativement par Node 24 en type stripping). Les contrats entre couches sont des types explicites, majoritairement **déduits des schémas Zod** (une seule source de vérité forme + validation).
6. **Peu de dépendances, mais les bonnes** : Zod (validation), Pinia (stores), ESLint + Prettier (dev). En revanche pas de framework HTTP ni de conteneur DI : router maison (~40 lignes) et injection par simple passage d'arguments, car à cette échelle ils remplacent avantageusement Express et consorts.

## 2. Vue d'ensemble

```
┌────────────────────────── NAVIGATEUR ──────────────────────────┐
│  components/  (rendu, interactions)                            │
│      │ props/emits                                             │
│  stores/      (état réactif, actions, filtres calculés)        │
│      │ appels                                                  │
│  api/         (fetch, normalisation des erreurs)               │
└──────┼─────────────────────────────────────────────────────────┘
       │ HTTP (JSON)
┌──────┼─────────────────────── SERVEUR ─────────────────────────┐
│  routes/       (parse la requête, appelle le service,          │
│      │          traduit les erreurs en codes HTTP)             │
│  services/     (règles métier, transactions, UUID, timestamps) │
│      │                                                         │
│  repositories/ (SQL uniquement, mapping row ↔ DTO)             │
│      │                                                         │
│  db.ts         (connexion node:sqlite, schéma, migrations)     │
└─────────────────────────────────────────────────────────────────┘
            shared/  (enums, validation : importé par les DEUX côtés)
```

## 3. Backend

### 3.1 Les couches

| Couche | Fichiers | Sait faire | Ne sait PAS faire |
|---|---|---|---|
| **Routes** | `routes/*.routes.ts` | Extraire params/body, appeler le service, mapper les erreurs typées en statuts HTTP | Du SQL, des règles métier |
| **Services** | `services/*.service.ts` | Règles métier (identité minimale, unicité gameId, anti-doublon), génération UUID/timestamps, orchestration transactionnelle | Parler HTTP, écrire du SQL |
| **Repositories** | `repositories/*.repo.ts` | Requêtes préparées, mapping `snake_case` (SQL) ↔ `camelCase` (DTO), reconstruction de l'objet `position` | Valider, décider |
| **db** | `db.ts` | Ouvrir la base, `PRAGMA foreign_keys=ON` + WAL, créer le schéma, migrations par `schema_version` | Tout le reste |

### 3.2 Injection de dépendances légère (sans framework)

Les repositories sont des **fonctions qui prennent `db` en premier argument**. Les services sont créés par une **factory** qui reçoit ses dépendances. Le câblage se fait en un seul endroit, la racine de composition (`server.ts`) :

```ts
// repositories/characters.repo.ts — SQL pur, fonctions
export function findAll(db: DatabaseSync): Character[] { /* SELECT ... */ }
export function insert(db: DatabaseSync, character: Character): void { /* INSERT ... */ }

// services/characters.service.ts — métier pur, factory
export function createCharactersService({ db, charactersRepo, groupsRepo }: Deps) {
  return {
    create(input: unknown): Character {
      const data = characterInputSchema.parse(input)   // shared/schemas.ts → ZodError
      // règle métier : identité minimale, unicité gameId...
      const character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return db.transaction(() => {
        charactersRepo.insert(db, character)
        groupsRepo.setForCharacter(db, character.id, data.groups)
        return charactersRepo.findById(db, character.id)
      })
    },
    // update, remove, ...
  }
}

// server.ts — racine de composition : le SEUL endroit qui assemble tout
const db = openDb('data/codex.db')
const services = createServices(db)     // instancie tous les services
const router = createRouter(services)   // branche toutes les routes
http.createServer(router).listen(4750)
```

Tester un service = lui passer une base `:memory:` et les vrais repos. Aucun mock à écrire.

### 3.3 Erreurs typées

Les services lancent des erreurs métier nommées ; la couche route est la seule à connaître leur traduction HTTP :

| Erreur | Levée quand | Statut HTTP |
|---|---|---|
| `ZodError` / `ValidationError` | Champ invalide, identité minimale absente | 400 |
| `NotFoundError` | UUID inconnu | 404 |
| `ConflictError` | `gameId` déjà pris | 409 |
| (toute autre) | Bug | 500 + log serveur |

Implémentation : de simples classes d'erreur dans `lib/errors.ts` (seule entorse au « pas de classes », c'est l'idiome JS pour `instanceof`). Le routeur a un unique `try/catch` central : aucune route n'a besoin de gérer ses erreurs.

### 3.4 Transactions (le volet ACID)

`node:sqlite` est synchrone : les transactions sont de simples fonctions englobantes (`BEGIN`/`COMMIT`/`ROLLBACK` via un helper `db.transaction(fn)`). Sont transactionnels :

- création/mise à jour d'un personnage **avec** ses liaisons de groupes ;
- l'import complet (mode replace et merge) ;
- la suppression d'un personnage (la cascade `character_groups` est gérée par la contrainte FK).

L'upload d'avatar (fichier hors SQL) suit la règle : **base d'abord, fichier ensuite**. Si l'écriture du fichier échoue, la fiche existe sans avatar, état dégradé mais cohérent ; jamais l'inverse (un fichier orphelin sans fiche).

### 3.5 Routeur maison

~40 lignes dans `lib/router.ts` : une table `[méthode, regex, handler]`, extraction des params nommés, parsing JSON du body, réponse JSON systématique. Les fichiers statiques (front buildé, image de carte, avatars) sont servis par un handler dédié avec whitelist d'extensions et normalisation du chemin (pas de `..`).

## 4. Contrats partagés : `shared/`

Modules ESM purs (aucun import Node ni navigateur), consommés par les deux côtés :

```
shared/
├── enums.ts        # RACES (10 + Inconnue), RELATIONS, POI_TYPES
│                   # objets `as const` + types dérivés (pas d'enum TS : non
│                   # supporté par le type stripping de Node)
└── schemas.ts      # schémas Zod : characterInputSchema, groupSchema, poiSchema
                    # + types déduits : type Character = z.infer<typeof ...>
```

- **Zod est la source de vérité unique** : le schéma définit à la fois la validation (`schema.parse(input)` nettoie ou lance) et le type TypeScript (`z.infer`). Impossible que le type et la validation divergent.
- Le **front** les utilise pour le confort (options des dropdowns, validation de formulaire avant envoi).
- Le **back** les ré-exécute systématiquement : **le serveur est l'autorité**, la validation front n'est qu'une aide UX. Une `ZodError` est traduite en 400 par le routeur, au même titre qu'une `ValidationError` métier.
- Une règle qui change (nouvelle race, nouveau type de POI) se change dans UN fichier.

## 5. Frontend

### 5.1 Stores : Pinia

Stores **Pinia** en syntaxe setup (`defineStore('characters', () => {...})`) : le standard officiel Vue, inspectable dans les Vue Devtools (état, timeline des actions) :

```
src/stores/
├── bootstrap.ts          # chargement initial (GET /api/data → remplit les stores)
├── characters.store.ts   # state characters, actions CRUD (await api → maj state)
├── groups.store.ts       # state groups + CRUD
├── notes.store.ts        # notes générales (debounce, cf. #72)
├── pois.store.ts         # state pois + CRUD (mode édition POI)
├── stories.store.ts      # state stories + CRUD
└── ui.store.ts           # état d'interface : recherche, filtres, sélection,
                          # mode placement, modale ouverte
```

- **Écriture pessimiste** : une action attend la réponse du serveur puis met à jour l'état à partir du DTO retourné (latence locale ≈ 0, ça simplifie tout : pas de rollback optimiste).
- Les **données dérivées** sont des getters (`computed`) des stores : `filteredCharacters` (recherche + filtres), `duplicateSuggestions` (anti-doublon), `groupById`.
- Les composants **ne touchent jamais** l'état en écriture : ils appellent les actions.

### 5.2 Couche API

```
src/api/
├── http.ts            # wrapper fetch : base URL, JSON, erreurs normalisées
├── endpoints.ts       # un module par ressource regroupé : characters, groups,
│                      # pois, avatars, transfer (export/import) — typé par shared/
└── singleton.ts       # l'instance unique du client, câblée sur /api
```

`http.ts` convertit les statuts d'erreur en objets `{ code, message, field? }` uniformes que les stores savent afficher. Personne d'autre n'appelle `fetch`.

### 5.3 Composants

```
src/components/
├── characters/               # briques propres aux fiches (ex. CharacterAvatar.vue)
├── groups/                   # briques propres aux groupes (ex. GroupCreateRow.vue)
├── layout/
│   ├── SidebarPanel.vue      # colonne fixe : onglets + slots recherche/liste/pied
│   └── ToolbarButton.vue     # bouton icône doré réutilisable (le seul bouton du projet)
├── sidebar/                  # un panneau + une carte par onglet
│   ├── SearchBar.vue
│   ├── FilterDropdown.vue    # dropdown custom générique (options en props)
│   ├── CharactersPanel.vue   # (idem pour Groups, Pois, Stories)
│   └── CharacterCard.vue     # carte compacte + bande relation + actions
├── map/
│   ├── MapView.vue           # SEUL point de contact avec Leaflet (cf. docs/leaflet-et-vue.md)
│   └── pinIcon.ts            # fabrique le HTML des divIcon (pur : données → string)
│                             # + poiMarker.ts, markerStacking.ts, placementMode.ts (purs)
├── modals/
│   ├── ModalShell.vue        # overlay + cadre + fermeture Échap/clic dehors
│   ├── CharacterModal.vue    # formulaire fiche + suggestions anti-doublon
│   ├── GroupModal.vue        # édition d'un groupe et de sa note longue (#113)
│   ├── StoryModal.vue        # édition d'une histoire et de sa note (#83)
│   └── ConfirmDialog.vue     # confirmation générique (suppression)
├── notes/
│   └── NotesPanel.vue        # notes générales, écriture debouncée (#72)
└── transfer/
    └── TransferButtons.vue   # export (téléchargement) / import (file input + choix mode)
```

Les fichiers ci-dessus sont représentatifs, pas exhaustifs : le dossier réel fait autorité.

Règles :

- `MapView.vue` est **le seul fichier qui importe Leaflet**. Il reçoit des props (personnages filtrés, POI, toggles), émet des événements (`pin-click`, `map-click`, `poi-moved`). Les instances Leaflet vivent dans des variables non réactives (voir [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md)).
- Les composants de `sidebar/` et `modals/` sont **bêtes** : props + emits, aucun appel API direct. C'est `App.vue` (et les stores) qui orchestrent.
- `pinIcon.ts` et les utilitaires sont des **fonctions pures** testables sans DOM.

### 5.4 Utilitaires purs

```
Un fichier = une fonction ou un petit groupe de fonctions sans dépendance au DOM, testables en `node:test`. Quelques exemples représentatifs (la liste réelle est plus longue) :

```
src/lib/
├── coords.ts          # conversions pixels image ↔ LatLng CRS.Simple (2 fonctions)
├── imageResize.ts     # File → Blob WebP 256px via canvas
├── debounce.ts        # utilisé uniquement pour les notes (#72, #83, #113)
└── text.ts            # normalize() pour recherche et anti-doublon (minuscules,
                       # sans accents), match()
```

### 5.5 Le mode placement (machine à états)

Le placement de la position traverse modale + carte + store : c'est le flux le plus délicat, on le fixe explicitement dans `ui.store.ts` :

```
état: { placement: null | { modalTarget: id | 'new', draft: {...formulaire} } }

CharacterModal [clic épingle]
   → ui.startPlacement(draftDuFormulaire)   # la modale se ferme
MapView (placement actif : curseur croix, clic carte)
   → emit('map-click', {x, y})
App.vue
   → ui.completePlacement(x, y)   # aucun libellé déduit (#79)
   → rouvre CharacterModal avec le draft restauré + position pré-remplie
[Échap ou clic bouton annuler] → ui.cancelPlacement() → rouvre la modale telle quelle
```

Le brouillon du formulaire est conservé dans l'état de placement : on ne perd jamais une saisie en cours en allant cliquer sur la carte.

## 6. Flux de référence

### Création d'un personnage avec photo

```
CharacterModal (submit)
 → characters.store.create(draft)
    → validation shared (confort) → POST /api/characters
       → route → service (validation autorité, UUID, transaction fiche+groupes) → 201 DTO
    → si photo choisie : imageResize(file) → POST /api/avatars/:id → DTO à jour
    → state.characters mis à jour, modale fermée
```

### Import d'un bundle

```
TransferButtons (fichier + mode choisi)
 → transfer.api.import(file, mode)
    → POST /api/import?mode=merge
       → service transfer : transaction unique
          replace : purge tables + purge avatars/ → insertions
          merge   : correspondance gameId sinon id interne → upsert
          décodage base64 → data/avatars/
 → stores rechargés via GET /api/data (reset complet, plus simple qu'un diff)
```

## 7. Tests

Runner : **`node:test`** (natif, exécute les `.test.ts` directement grâce au type stripping). `npm test` enchaîne `vue-tsc --noEmit` (vérification des types sur tout le projet, `.vue` compris) puis les tests.

| Cible | Comment | Priorité |
|---|---|---|
| Services (métier) | base `:memory:`, vrais repos : identité minimale, unicité gameId, cascade groupes | Haute |
| Transfer export→import | round-trip complet sur `:memory:` : exporter, réimporter (2 modes), comparer | Haute |
| `shared/schemas.ts` | cas valides/invalides des schémas Zod | Haute |
| `src/lib/*` (purs) | `coords`, `text`, filtres et brouillons en node:test aussi (aucune API navigateur) | Moyenne |
| Composants Vue | non testés en v1 (la maquette validée sert de contrat visuel) | Basse |

`imageResize.ts` (canvas) est la seule brique non testable en Node : elle reste volontairement minuscule.

## 8. Conventions

- **ESM partout** (`"type": "module"`), Node ≥ 24, **TypeScript partout**.
- **Syntaxe TS effaçable uniquement** (contrainte du type stripping de Node, et bonne pratique de toute façon) : annotations, interfaces, génériques oui ; `enum`, `namespace`, parameter properties non. Les enums sont des objets `as const`. Côté serveur, les imports relatifs portent l'extension `.ts` explicite.
- **ESLint** (flat config + `eslint-plugin-vue` + `typescript-eslint`) et **Prettier** : `npm run lint` et `npm run format`, à passer avant chaque commit.
- **Encodage UTF-8 sans BOM**, fins de ligne LF.
- Nommage : `camelCase` TS/JSON, `snake_case` SQL, la conversion vit exclusivement dans les repositories.
- Pas de commentaire de narration ; un commentaire = une contrainte non évidente.
- Les dates sont des chaînes ISO 8601 UTC, générées côté serveur uniquement.
- CSS : variables de thème dans `src/styles/theme.css` (reprises de la maquette), pas de framework CSS.
- En dev : `vite` (front, port 5173) proxy `/api` vers le serveur Node (4750) ; en usage : le serveur Node sert le build.
- Scripts npm : `dev` (vite + serveur), `build`, `start`, `test` (typecheck + node:test), `lint`, `format`, `electron` (app desktop en dev), `dist:electron` (build de l'exécutable).

## 9. Arborescence complète

```
keizaal-codex/
├── ARCHITECTURE.md
├── design/mockup.html
├── docs/leaflet-et-vue.md
├── docs/github-actions.md     # CI et pipeline de release
├── package.json               # scripts : dev, build, start, test, lint, format,
│                              #           electron, dist:electron
├── vite.config.ts
├── tsconfig.json              # strict, couvre shared/ + server/ + src/ + tests/
├── eslint.config.js           # flat config + vue + typescript-eslint
├── .prettierrc
├── shared/
│   ├── enums.ts
│   └── schemas.ts              # schémas Zod + types déduits (z.infer)
├── server/
│   ├── server.ts               # racine de composition + démarrage
│   ├── db.ts                   # connexion, schéma, migrations
│   ├── lib/
│   │   ├── router.ts           # routeur maison
│   │   ├── errors.ts           # ValidationError, NotFoundError, ConflictError
│   │   └── static.ts           # fichiers statiques sécurisés
│   ├── routes/                 # characters, groups, pois, notes, stories,
│   │                           # avatars, transfer, data
│   ├── services/               # characters, groups, pois, notes, stories,
│   │                           # avatars, transfer
│   └── repositories/           # characters, groups, pois, notes, stories
├── electron/
│   ├── main.ts                 # fenêtre desktop + démarrage du serveur Node
│   └── paths.ts                # emplacement des données dans le dossier utilisateur
├── src/
│   ├── main.ts
│   ├── App.vue                 # orchestration : branche stores ↔ composants
│   ├── styles/theme.css
│   ├── api/        (http.ts, endpoints.ts, singleton.ts)
│   ├── stores/     (bootstrap, characters, groups, notes, pois, stories, ui — Pinia)
│   ├── lib/        (coords, imageResize, text, debounce, filtres, brouillons, …)
│   └── components/ (characters/, groups/, layout/, sidebar/, map/, modals/,
│                    notes/, transfer/)
├── tests/                      # un fichier par module testé (services, schémas,
│                               # routeur, stores, utilitaires purs, …)
├── public/map/                 # image(s) de la carte
└── data/                       # gitignoré : codex.db, avatars/
```

## 10. Correspondance avec les principes demandés

- **SOLID** : responsabilité unique par module (S) ; on étend en ajoutant un module route/service/repo, pas en modifiant les existants (O) ; les services dépendent d'interfaces implicites (fonctions repo) injectées à la racine de composition (D). L/I concernent les hiérarchies de classes, peu applicables en style fonctionnel.
- **ACID** : transactions SQLite sur toute opération multi-écriture (§3.4), contraintes en base (CHECK, UNIQUE, FK) comme dernier rempart.
- **Clean** : dépendances vers l'intérieur, métier isolé du transport et du stockage, racine de composition unique. Ajouter une fonctionnalité (ex. : historique des rencontres en v2) = nouvelle table + nouveau repo + nouveau service + nouvelle route + nouveau store, sans toucher l'existant.
