# Codex Keizaal — Contexte projet

Application web **locale et perso** (mono-utilisateur) de suivi des personnages rencontrés sur le serveur RP Skyrim Keizaal (https://keizaal.com/fr) : fiches personnages dans une sidebar, carte de Skyrim interactive avec pins, le tout remplace des post-its.

## État actuel

**Développement actif, piloté par les issues GitHub** (une issue = une branche = une PR). L'état du code fait autorité : les schémas Zod de `shared/`, la structure des dossiers (`server/`, `src/`, `electron/`) et les tests de `tests/` sont la référence à jour, pas un document de spécification. Les documents restants ne décrivent que ce qui ne se lit pas dans le code :

| Document | Rôle |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Couches back (route → service → repository), stores front, contrats partagés, flux, tests, conventions |
| [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md) | Règles d'intégration Leaflet dans Vue 3 (instances hors réactivité, flux unidirectionnel) |
| [docs/github-actions.md](docs/github-actions.md) | Guide GitHub Actions : CI et pipeline de release |
| [design/mockup.html](design/mockup.html) | Maquette statique validée = **source de vérité visuelle** (palette dorée #D9B54A sur fond #2E3442, boutons icône-only, cartes sans fond avec bande de relation) |

## Stack (décidée, ne pas remettre en question sans discussion)

- **Front** : Vue 3 + Vite + Pinia + Leaflet (`CRS.Simple`), TypeScript
- **Back** : Node ≥ 24 natif (module `http`, PAS de framework HTTP : router maison ~40 lignes, choix argumenté dans ARCHITECTURE.md §1), TypeScript exécuté nativement (type stripping → syntaxe effaçable uniquement, pas d'`enum` TS)
- **Stockage** : SQLite via `node:sqlite` (natif), base `data/codex.db` + avatars fichiers dans `data/avatars/`
- **Validation** : Zod dans `shared/` (schémas = source unique des types via `z.infer`, le serveur est l'autorité)
- Dépendances runtime limitées à : `vue`, `leaflet`, `pinia`, `zod`. **Toute nouvelle dépendance doit être validée explicitement par Paul avant ajout.**

## Décisions clés (le « pourquoi » qui ne se devine pas)

- **Identité minimale d'un personnage : `name` OU `gameId`** (3 cas réels : croisé sans présentation = gameId seul ; présenté = les deux ; « on m'en a parlé » = nom seul). `gameId` = le `#XXXXX` visible en jeu, unique si renseigné. Clé primaire = UUID v4 autogénéré.
- **Une seule position par personnage** : un `position` `{ x, y }` (#80 a abandonné le modèle initial à deux positions `homePosition`/`knownPosition`), supprimable, affiché sur la carte avec un pin à bordure pleine (le pin en pointillé n'existe plus).
- **Pas de champ « vu le »** ni bouton dédié : ce suivi se fait en texte libre dans la note (décision explicite de Paul).
- **POI en base**, entièrement créés par l'utilisateur via le mode édition de la carte : **aucun seed** (le seed initial `config/pois.json` a été retiré, cf. #50).
- **Anti-doublon** : à la saisie nom/gameId, suggérer les fiches existantes (le cas « je rencontre enfin la personne dont on m'a parlé » doit compléter la fiche, pas en créer une).
- **Écriture pessimiste** côté front (on attend la réponse serveur), pas de debounce ni d'optimistic update : latence locale nulle. **Trois exceptions, assumées** : les notes générales (#72), les notes d'histoire (#83) et les notes de groupe (#113), où la frappe est continue, un aller-retour par caractère n'a pas de sens. Même debounce de 1 s, vidé à la fermeture (et, pour les notes générales, annulé avant un import). `src/lib/debounce.ts` n'est utilisé que là.
- **Export/import** : un seul fichier JSON autonome (avatars en base64 à l'export seulement), import transactionnel replace/merge.
- **Patch notes** (#94) : le body d'une release GitHub est **réécrit à la main après publication** (en français, orienté utilisateur, sections « Nouveautés » / « Corrections » en puces). C'est ce body que la modale de mise à jour affiche ; le check ayant lieu à chaque lancement, une édition tardive est bien vue par l'app. Le workflow de release garde son `--generate-notes`.

## Workflow de travail convenu

1. Chaque évolution (fonctionnalité, correction, dette) est une **issue GitHub** dédiée : c'est là que vivent le besoin, les critères d'acceptation et la discussion.
2. **Un ticket = un worktree Git + une branche `feat/<n° issue>` créée depuis `main`.**
3. **TDD** : d'abord les tests (commit), puis l'implémentation au vert (commit), puis le refactor (commit). Commits et push **en autonomie** sur la branche, sans validation préalable.
4. Ticket terminé et vérifié → **créer la PR vers `main`** (`Closes #<n°>`). Paul relit et fait ses retours sur la PR ; y répondre/corriger jusqu'à décision de merge. **Le merge est la décision de Paul.**
5. Messages de commit et titres/descriptions de PR **en anglais** ; conversation en français.
6. Ne pas élargir le scope d'un ticket sans validation ; une idée en cours de route = un nouveau ticket.
7. Fichiers en **UTF-8 sans BOM** (attention Windows), fins de ligne LF.
8. `npm run lint` et `npm test` doivent passer avant chaque commit. Respecter SOLID / Clean Architecture (cf. ARCHITECTURE.md) : le projet doit pouvoir perdurer.
