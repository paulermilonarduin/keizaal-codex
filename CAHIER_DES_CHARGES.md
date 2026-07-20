# Cahier des charges : Codex Keizaal

Application web locale de suivi des personnages rencontrés sur le serveur RP Skyrim **Keizaal** (https://keizaal.com/fr). Remplace les post-its : qui est qui, où ils vivent, où on les a vus pour la dernière fois.

---

## 1. Objectif

- Retenir les personnages croisés en jeu : identité, race, rôle, relation, notes.
- Les visualiser sur une carte de Skyrim haute résolution (zoom + drag).
- Pouvoir tout exporter/importer facilement (sauvegarde, portabilité).
- Usage strictement local et perso, mono-utilisateur.

## 2. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Front | **Vue 3** (Composition API) + **Vite** | Réactivité pour la liste, les filtres et les modales, build léger |
| Carte | **Leaflet** en `CRS.Simple` | Zoom, pan, marqueurs sur image, ~40 ko, standard éprouvé |
| Back | **Node.js natif** (module `http`, zéro framework) | ~150 lignes : sert le front buildé + une petite API JSON |
| Stockage | **SQLite natif** (`node:sqlite`, base `data/codex.db`) + dossier **`data/avatars/`** | Zéro dépendance (intégré à Node ≥ 22.5, ici v24), écritures atomiques, pas de risque de corruption. L'export JSON sert de sauvegarde lisible |

Le projet est intégralement en **TypeScript** : le serveur tourne nativement sur Node 24 (type stripping), Vite gère le front, `tsc --noEmit` vérifie les types.

Dépendances runtime : `vue`, `leaflet`, `pinia` (stores), `zod` (validation). Dépendances dev : `vite`, `@vitejs/plugin-vue`, `typescript`, ESLint + Prettier. C'est tout, et c'est voulu : chaque ajout est justifié par la maintenabilité, pas par le confort du moment.

Lancement : `npm run start` (build si nécessaire + serveur sur `http://localhost:4750`).

## 3. La carte

- **Image source** : carte HQ classique de Skyrim (style carte in-game/papier), à sourcer lors de l'implémentation (usage perso local). Si la résolution le justifie, découpage en tuiles pour garder un zoom fluide.
- **Interactions** : zoom molette, drag pour déplacer la vue, bornes pour ne pas sortir de la carte.
- **Points d'intérêt (POI)** : stockés **en base** (table `pois`), initialisés au premier lancement depuis le fichier seed `config/pois.json` (éditable à la main) :

```json
[
  { "name": "Blancherive", "type": "capitale", "x": 2450, "y": 3100 },
  { "name": "Rivebois", "type": "village", "x": 2600, "y": 3600 }
]
```

Types prévus : `capitale`, `ville`, `village`, `fort`, `autre`. Les POI s'affichent comme des étiquettes discrètes sur la carte (taille/visibilité selon le niveau de zoom).

- **Mode édition des POI** intégré à l'appli (toggle dans la barre d'outils de la carte) : la carte passe en mode calibrage, un clic affiche les coordonnées et permet de **créer** un POI à cet endroit ; les POI existants deviennent **déplaçables, renommables et supprimables**. Ce mode sert à la fois au calibrage initial de la carte et à l'ajout de ses propres lieux par la suite.
- Les POI sont **décoratifs et repères** : le placement des pins personnages est **totalement libre** (on peut placer plusieurs personnages autour de Blancherive : un au nord, un à l'est, etc.).

## 4. Modèle de données

### Personnage

```json
{
  "id": "3f2b8c1a-9d4e-4c7b-a1f0-6e5d2c8b9a41",
  "gameId": "#48213",
  "name": "Compte-les-Sous",
  "race": "Argonien",
  "relation": "ami",
  "role": "Aubergiste",
  "groups": ["7c0a2e5f-1b3d-4a86-9c2e-d4f7b0a318c6"],
  "note": "Tient l'auberge de Blancherive, bavard, aime les septims.",
  "avatar": "avatars/3f2b8c1a-9d4e-4c7b-a1f0-6e5d2c8b9a41.webp",
  "homePosition": { "x": 2450, "y": 3120, "label": "Blancherive" },
  "knownPosition": { "x": 1100, "y": 900, "label": "Solitude", "date": "2026-07-15" },
  "createdAt": "2026-07-01T18:00:00Z",
  "updatedAt": "2026-07-17T20:30:00Z"
}
```

Règles :
- **`id` : UUID v4 autogénéré** côté serveur à la création (`crypto.randomUUID()`, natif Node, zéro dépendance). Purement technique, jamais saisi ni affiché ; c'est la clé primaire, la référence des relations (groupes) et le nom de fichier de l'avatar.
- **Identité minimale : `name` OU `gameId`** (au moins l'un des deux). Trois cas d'usage réels :
  1. **gameId seul** : on a croisé le personnage (le `#XXXXX` est toujours visible en jeu) mais il ne s'est pas présenté ;
  2. **nom + gameId** : le personnage s'est présenté ;
  3. **nom seul** : quelqu'un nous a parlé du personnage, on ne l'a jamais vu (les gens donnent le nom, jamais l'ID).
- Une fiche se complète au fil du temps : on rencontre enfin le personnage dont on avait entendu parler → on ajoute son `gameId` à la fiche existante (et inversement).
- **Anti-doublon** : à la saisie du nom ou du gameId dans la modale, l'appli suggère les fiches existantes proches, pour compléter une fiche plutôt que d'en créer une seconde sans le savoir.
- `gameId` est **unique quand il est renseigné**.
- `relation` : `ami` | `neutre` | `ennemi` | `inconnu` (défaut : `inconnu`).
- `race` : **liste fermée** des 10 races jouables en français + `Inconnue` (défaut) : Nordique, Impérial, Bréton, Rougegarde, Haut-elfe, Elfe des bois, Elfe noir, Orque, Khajiit, Argonien. Le filtre de la liste ajoute une entrée « Toutes races ».
- `label` d'une position : texte libre, pré-rempli avec le POI le plus proche du clic (modifiable).
- Le suivi des rencontres (« vu le X à tel endroit ») se fait en texte libre dans `note` ; seule la `knownPosition` porte une date optionnelle, affichée dans l'info-bulle de son indicateur.
- Chaque position (`homePosition`, `knownPosition`) est indépendante et **supprimable** individuellement depuis la modale (une info de position se périme).
- Tous les autres champs sont optionnels.

### Groupe / faction

```json
{ "id": "7c0a2e5f-1b3d-4a86-9c2e-d4f7b0a318c6", "name": "Compagnons", "color": "#c0392b", "description": "" }
```

- `id` : UUID v4 autogénéré, comme pour les personnages.

- CRUD complet depuis l'UI (petite modale de gestion des groupes).
- Un personnage peut appartenir à **plusieurs groupes**.
- La couleur du groupe sert de badge sur les cartes personnage et de filtre.

### Schéma SQLite

Les modèles JSON ci-dessus sont la représentation échangée avec le front (API) et utilisée à l'export. En base :

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);  -- schema_version, etc.

CREATE TABLE groups (
  id          TEXT PRIMARY KEY,      -- UUID v4 (crypto.randomUUID())
  name        TEXT NOT NULL,
  color       TEXT,
  description TEXT
);

CREATE TABLE characters (
  id         TEXT PRIMARY KEY,       -- UUID v4 (crypto.randomUUID())
  game_id    TEXT UNIQUE,            -- optionnel, unique si renseigné
  name       TEXT,
  race       TEXT,
  relation   TEXT NOT NULL DEFAULT 'inconnu',
  role       TEXT,
  note       TEXT,
  avatar     TEXT,
  home_x     REAL, home_y REAL, home_label TEXT,
  known_x    REAL, known_y REAL, known_label TEXT, known_date TEXT,
  created_at TEXT,
  updated_at TEXT,
  CHECK (game_id IS NOT NULL OR name IS NOT NULL)
);

CREATE TABLE character_groups (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, group_id)
);

CREATE TABLE pois (
  id   TEXT PRIMARY KEY,              -- UUID v4 (crypto.randomUUID())
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  x    REAL NOT NULL,
  y    REAL NOT NULL
);
```

La `schema_version` stockée dans `meta` permet des migrations futures du schéma. La base est explorable avec n'importe quel outil SQLite (DB Browser for SQLite, etc.).

## 5. Fonctionnalités

### 5.1 Carte et pins

- **Deux pins possibles par personnage** :
  - **Position générale** (domicile/poste habituel) : pin rond avec la photo de profil (**« ? » si pas de photo**), bordure pleine.
  - **Position connue** (`knownPosition` : dernière fois que le personnage a été vu ou signalé quelque part) : même pin avec bordure **pointillée** (seule distinction visuelle sur la carte, pas de badge).
- **Couleur de bordure du pin = relation** (vert ami, gris neutre, rouge ennemi, bleu inconnu).
- **Étiquette au survol** : le nom (ou le gameId) apparaît sous le pin uniquement quand le curseur est **précisément sur le cercle** du pin, pas sur la zone autour. Pas de date dans l'étiquette.
- **Placement** : depuis la fiche ou la modale, bouton « Placer sur la carte » → mode placement (curseur croix), un clic pose le pin, `label` pré-rempli avec le POI le plus proche.
- **Clic sur un pin, deux effets simultanés** :
  - une **mini-fiche popup** s'ouvre à côté du pin (photo, nom, gameId, race, rôle, relation) avec un bouton « Ouvrir la fiche » ; elle se place **à droite ou à gauche du pin selon la place disponible** à l'écran ;
  - dans la liste, la carte du personnage est **surlignée et scrollée** en vue.
- Toggle global pour afficher/masquer chaque type de pin (générale / connue).

### 5.2 Liste des personnages (sidebar gauche)

- La sidebar est un **panneau flottant superposé à la carte** (overlay) : replier/déplier la fait glisser hors champ sans jamais redimensionner la carte.
- Cartes compactes, **sans fond** (bordure dorée seule) : photo, nom (ou gameId si pas de nom), race, rôle, badge(s) groupe.
- **Relation = bande verticale colorée sur le bord gauche** de la carte (pas de pastille texte).
- **Icône « œil »** sous le bouton d'édition, présente uniquement si le personnage a une position connue ; son info-bulle donne le lieu et la date, et **un clic centre la carte sur cette position**.
- **Recherche** temps réel sur nom, gameId, rôle et note.
- **Filtres** : race (liste fermée + « Toutes races »), relation, groupe (la liste des groupes s'alimente dynamiquement depuis la base). Pas de sélecteur de tri : ordre alphabétique.
- Les filtres sont des **dropdowns custom** (pas de `<select>` natif) pour styler le survol des options (fond doré).
- **Synchronisation carte ↔ liste** :
  - survol d'une carte ↔ le pin correspondant se surligne, et inversement ;
  - clic sur une carte → la vue se centre sur son pin (priorité : position connue, sinon générale) ;
  - clic sur un pin → mini-fiche popup + carte surlignée et scrollée dans la liste (cf. 5.1).

### 5.3 Modale personnage (création / édition)

- **Format compact** (~440 px, une seule colonne, avatar centré en haut).
- Tous les champs du modèle, **nom ou gameId requis** (au moins l'un des deux). Relation en pastilles segmentées, groupes en chips multi-sélection.
- **Suggestion anti-doublon** : pendant la saisie du nom ou du gameId, les fiches existantes qui correspondent s'affichent ; en choisir une bascule en édition de cette fiche au lieu d'en créer une nouvelle.
- **Photo de profil** : choisie directement dans le formulaire (y compris à la création), redimensionnée côté client (~256 px, WebP), stockée dans `data/avatars/`. Côté technique, l'enregistrement se fait en deux temps transparents pour l'utilisateur : création/mise à jour de la fiche d'abord, upload de l'avatar ensuite (l'avatar a besoin de l'UUID de la fiche).
- Sélection des groupes (multi) + création rapide d'un groupe à la volée.
- Boutons sur chaque position (générale / connue) : **« replacer »** (icône épingle, bascule en mode placement sur la carte) et **« supprimer »** (croix, efface juste cette position, l'info se périme).
- Actions en pied de modale en **icônes seules** : poubelle (supprimer la fiche, avec confirmation), croix (annuler), coche (enregistrer).

### 5.4 Import / export

- **Export** : un seul fichier `codex-keizaal-YYYY-MM-DD.json` autonome, avatars **embarqués en base64** au moment de l'export (les fichiers d'avatars restent des fichiers en usage normal, l'encodage ne se fait qu'à l'export). Pas de zip, pas de dépendance.
- **Import** : charge un fichier d'export, décode les avatars vers `data/avatars/`, avec choix : **remplacer tout** ou **fusionner**. En mode fusion, la correspondance se fait sur le `gameId` quand il est renseigné, sinon sur l'`id` interne ; sans correspondance, la fiche est créée. L'import s'exécute dans une transaction SQLite : soit tout passe, soit rien.
- L'export JSON tient lieu de **sauvegarde lisible** de la base (à faire régulièrement, ou à automatiser plus tard).

## 6. API locale

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/data` | Charge tout (characters + groups + pois) en JSON |
| POST / PUT / DELETE | `/api/characters(/:id)` | CRUD personnage (met aussi à jour ses groupes) |
| POST / PUT / DELETE | `/api/groups(/:id)` | CRUD groupe |
| POST / PUT / DELETE | `/api/pois(/:id)` | CRUD point d'intérêt (mode édition des POI) |
| POST | `/api/avatars/:id` | Upload d'un avatar |
| DELETE | `/api/avatars/:id` | Suppression d'un avatar |
| GET | `/api/export` | Génère le bundle JSON autonome |
| POST | `/api/import?mode=replace|merge` | Import d'un bundle (transactionnel) |

Règles transverses :
- Le front garde l'état en mémoire (store Vue léger, `reactive`) et envoie chaque modification immédiatement : SQLite écrit de façon atomique, pas besoin de debounce ni de fichier `.bak`.
- **Validation systématique des `:id`** (format UUID) avant tout accès fichier ou requête, notamment sur les routes avatars (empêche toute écriture hors de `data/avatars/`).

## 7. UI / Layout

**Maquette de référence : [design/mockup.html](design/mockup.html)** (HTML statique validé, source de vérité visuelle pour l'implémentation).

```
┌────────────────╥──────────────────────────────────────┐
│  🔍 Recherche  ║                                      │
│ Race▾ Rel▾ Grp▾║                                      │
│ ┃┌───────────┐ ║                                      │
│ ┃│ 🖼 Nom #ID │ ║            CARTE SKYRIM              │
│ ┃│ Race・Rôle │✎║        (Leaflet plein écran,         │
│ ┃│ (groupes)  │👁║      sidebar flottante par-dessus)   │
│ ┃└───────────┘ ║                                      │
│  ...           ║   ⊙ pins persos   ▪ étiquettes POI   │
│ [+][⚙][⇧][⇩]  ║                                      │
└────────────────╨──────────────────────────────────────┘
  ┃ = bande de relation   ✎ = éditer   👁 = position connue
```

- Sidebar ~340 px, **flottante au-dessus de la carte**, repliable par glissement (la carte occupe toujours 100% de l'écran).
- Thème sombre sobre inspiré de l'UI Skyrim, pas de fioritures qui alourdissent.

### Palette

| Usage | Couleur |
|---|---|
| Fond général | `#2E3442` |
| Accent doré (noms, icônes de boutons, toutes les bordures) | `#D9B54A` |
| Accent doré atténué (gameId affiché à côté d'un nom) | `#D9B54A` avec alpha réduit (~60%) |
| Texte courant (race, rôle, contenu) | `#C4C9CC` |
| Relations | ami `#7CB273` · neutre gris atténué · ennemi `#C1614F` · inconnu `#6E8FB0` |

Les bordures dérivent toutes du doré, mélangé au fond à des intensités variables (normale ~32%, soutenue ~60% pour hover/actif).

### Boutons

- **Icônes seules, pas de texte** : petits carrés (~30 px, ~24 px pour les actions secondaires), coins légèrement arrondis (~4-6 px).
- Fond `#2E3442`, bordure et icône **dorées** (`#D9B54A`).
- Au hover : le fond s'éclaircit légèrement vers `#C4C9CC` (pas d'aplat total), la bordure s'intensifie.
- `aria-label` + `title` systématiques (accessibilité + info-bulle qui compense l'absence de texte).
- Exception sémantique : le bouton supprimer reste rouge.

### Dropdowns de filtre

- Composant custom (trigger + menu), options avec **fond doré au survol** et texte sombre pour le contraste ; l'option sélectionnée est marquée en doré dans le menu.

## 8. Architecture et arborescence

Le découpage détaillé (couches back route → service → repository, stores front, contrats partagés, flux, tests, arborescence complète) est décrit dans **[ARCHITECTURE.md](ARCHITECTURE.md)**. Vue d'ensemble :

```
keizaal-codex/
├── CAHIER_DES_CHARGES.md / ARCHITECTURE.md
├── design/mockup.html     # maquette statique validée (référence visuelle)
├── docs/leaflet-et-vue.md # topo : intégrer Leaflet proprement dans Vue 3
├── shared/                # enums + validation communs front/back
├── server/                # Node natif : routes / services / repositories / db
├── src/                   # Front Vue 3 : api / stores / lib / components
├── tests/                 # node:test (métier, transfer, validation)
├── config/pois.json       # Seed des POI (import au premier lancement)
├── public/map/            # Image(s) / tuiles de la carte
└── data/                  # ⚠ données perso (gitignoré) : codex.db, avatars/
```

## 9. Hors périmètre (v1)

- Multi-utilisateur, authentification, accès distant.
- Application mobile / responsive poussé (cible : écran desktop).
