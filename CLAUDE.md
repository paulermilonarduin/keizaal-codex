# Codex Keizaal — Contexte projet

Application web **locale et perso** (mono-utilisateur) de suivi des personnages rencontrés sur le serveur RP Skyrim Keizaal (https://keizaal.com/fr) : fiches personnages dans une sidebar, carte de Skyrim interactive avec pins, le tout remplace des post-its.

## État actuel

**Phase de spécification terminée, aucune ligne de code applicatif écrite.** Tout est documenté et validé :

| Document | Rôle |
|---|---|
| [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md) | Fonctionnalités, modèle de données, schéma SQL, API, UI. **Validé, à respecter.** |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Couches back (route → service → repository), stores front, contrats partagés, flux, tests, arborescence cible |
| [docs/BACKLOG.md](docs/BACKLOG.md) | 18 tickets en 5 milestones, ordonnés avec dépendances et critères d'acceptation. **C'est le plan d'implémentation.** |
| [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md) | Règles d'intégration Leaflet dans Vue 3 (instances hors réactivité, flux unidirectionnel) |
| [design/mockup.html](design/mockup.html) | Maquette statique validée = **source de vérité visuelle** (palette dorée #D9B54A sur fond #2E3442, boutons icône-only, cartes sans fond avec bande de relation) |

## Stack (décidée, ne pas remettre en question sans discussion)

- **Front** : Vue 3 + Vite + Pinia + Leaflet (`CRS.Simple`), TypeScript
- **Back** : Node ≥ 24 natif (module `http`, PAS de framework HTTP : router maison ~40 lignes, choix argumenté dans ARCHITECTURE.md §1), TypeScript exécuté nativement (type stripping → syntaxe effaçable uniquement, pas d'`enum` TS)
- **Stockage** : SQLite via `node:sqlite` (natif), base `data/codex.db` + avatars fichiers dans `data/avatars/`
- **Validation** : Zod dans `shared/` (schémas = source unique des types via `z.infer`, le serveur est l'autorité)
- Dépendances runtime limitées à : `vue`, `leaflet`, `pinia`, `zod`. **Toute nouvelle dépendance doit être validée explicitement par Paul avant ajout.**

## Décisions clés (le « pourquoi » qui ne se devine pas)

- **Identité minimale d'un personnage : `name` OU `gameId`** (3 cas réels : croisé sans présentation = gameId seul ; présenté = les deux ; « on m'en a parlé » = nom seul). `gameId` = le `#XXXXX` visible en jeu, unique si renseigné. Clé primaire = UUID v4 autogénéré.
- **Deux positions par personnage** : `homePosition` (domicile) et `knownPosition` (dernière fois vu/signalé, avec date optionnelle). Chacune supprimable indépendamment. Pin plein vs pointillé sur la carte.
- **Pas de champ « vu le »** ni bouton dédié : ce suivi se fait en texte libre dans la note (décision explicite de Paul).
- **POI en base** (pas en fichier) avec mode édition/calibrage intégré à la carte ; `config/pois.json` n'est qu'un seed initial.
- **Anti-doublon** : à la saisie nom/gameId, suggérer les fiches existantes (le cas « je rencontre enfin la personne dont on m'a parlé » doit compléter la fiche, pas en créer une).
- **Écriture pessimiste** côté front (on attend la réponse serveur), pas de debounce ni d'optimistic update : latence locale nulle.
- **Export/import** : un seul fichier JSON autonome (avatars en base64 à l'export seulement), import transactionnel replace/merge.
- L'image HQ de la carte de Skyrim reste **à sourcer** (ticket #13).

## Workflow de travail convenu

1. Les 18 tickets du backlog sont des **issues GitHub** (#1–#18, numéros alignés) avec leurs 5 milestones.
2. **Un ticket = un worktree Git + une branche `feat/<n° issue>` créée depuis `main`.** Implémenter dans l'ordre du backlog (les dépendances y sont notées).
3. **TDD** : d'abord les tests (commit), puis l'implémentation au vert (commit), puis le refactor (commit). Commits et push **en autonomie** sur la branche, sans validation préalable.
4. Ticket terminé et vérifié → **créer la PR vers `main`** (`Closes #<n°>`). Paul relit et fait ses retours sur la PR ; y répondre/corriger jusqu'à décision de merge. **Le merge est la décision de Paul.**
5. Messages de commit et titres/descriptions de PR **en anglais** ; conversation en français.
6. Ne pas élargir le scope d'un ticket sans validation ; une idée en cours de route = un nouveau ticket.
7. Fichiers en **UTF-8 sans BOM** (attention Windows), fins de ligne LF.
8. `npm run lint` et `npm test` doivent passer avant chaque commit. Respecter SOLID / Clean Architecture (cf. ARCHITECTURE.md) : le projet doit pouvoir perdurer.

## Prochaine étape

Ticket #2 — Shared contracts (enums + schémas Zod), puis suivre l'ordre du backlog.
