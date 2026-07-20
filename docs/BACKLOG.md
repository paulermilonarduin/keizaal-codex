# Backlog : Codex Keizaal

Découpage du projet en tickets, à convertir en issues GitHub à la création du repo.
Un ticket = une branche (`feat/<n°>`) = une PR. Ordre = ordre d'implémentation, les dépendances sont indiquées.

Tailles : **S** (< 1 h), **M** (1 session), **L** (grosse session, candidat au re-découpage).

---

## Milestone 1 : Socle technique

### #1 — Project scaffolding `S`
Initialiser le projet : `package.json` (ESM, scripts dev/build/start/test/lint/format), `tsconfig.json` strict, ESLint flat config + Prettier, squelette Vite + Vue + Pinia qui affiche une page vide au thème sombre, `.gitignore` (dont `data/`).
- [ ] `npm run dev`, `npm run lint`, `npm test` (vide) passent
- [ ] `npm run build` produit un bundle servable

### #2 — Shared contracts : enums + schémas Zod `S`
`shared/enums.ts` (races FR, relations, types de POI en `as const`) et `shared/schemas.ts` (schémas Zod personnage/groupe/POI + types `z.infer`). Tests des cas valides/invalides.
- [ ] Identité minimale (name OU gameId) validée par le schéma
- [ ] Tests `schemas.test.ts` verts

### #3 — Couche base de données `M` — dépend de #2
`server/db.ts` : ouverture `node:sqlite`, pragmas (FK, WAL), création du schéma (4 tables + meta), mécanisme de migration par `schema_version`, seed des POI depuis `config/pois.json` au premier lancement, helper `transaction()`.
- [ ] Base créée de zéro au premier lancement, seed POI importé une seule fois
- [ ] Contraintes vérifiées par tests (CHECK identité, UNIQUE gameId, cascade FK)

### #4 — Cœur HTTP : routeur, erreurs, statiques `M`
`lib/router.ts` (table de routes, params nommés, body JSON, try/catch central), `lib/errors.ts` (erreurs typées → statuts), `lib/static.ts` (fichiers statiques sécurisés), `server.ts` (racine de composition). Proxy Vite `/api` → 4750.
- [ ] `GET /api/health` répond, erreur inconnue → 500 loggé, route inconnue → 404
- [ ] `ZodError` → 400 avec détail du champ

## Milestone 2 : API métier

### #5 — API Characters `M` — dépend de #3, #4
Repo + service + routes CRUD personnages, liaisons groupes incluses dans la même transaction. Mapping row ↔ DTO (`homePosition`/`knownPosition`).
- [ ] CRUD complet testé sur `:memory:` (dont conflit gameId → 409)
- [ ] Créer/mettre à jour avec groupes est atomique

### #6 — API Groups `S` — dépend de #5
Repo + service + routes CRUD groupes. Suppression → cascade des liaisons.
- [ ] CRUD testé, suppression d'un groupe ne supprime pas les personnages

### #7 — API POIs `S` — dépend de #3, #4
Repo + service + routes CRUD points d'intérêt.
- [ ] CRUD testé, `GET /api/data` renvoie characters + groups + pois

### #8 — API Avatars `S` — dépend de #5
Upload en body binaire brut (pas de multipart), validation UUID stricte avant tout accès fichier, écriture dans `data/avatars/<uuid>.webp`, suppression.
- [ ] Un id non-UUID → 400 sans toucher au disque
- [ ] Upload sur fiche inexistante → 404

### #9 — Export / import `M` — dépend de #5, #6, #7, #8
Service transfer : export bundle JSON autonome (avatars en base64), import `replace` / `merge` (correspondance gameId puis id interne) dans une transaction unique.
- [ ] Test round-trip : export → import sur base vierge → données identiques
- [ ] Import qui échoue à mi-chemin ne laisse aucune trace

## Milestone 3 : Front, liste et fiches

### #10 — Socle front : thème, API client, stores `M` — dépend de #4
`theme.css` extrait de la maquette (variables), `api/http.ts` + `endpoints.ts`, stores Pinia (characters, groups, pois, ui) avec chargement initial via `GET /api/data`. Layout : sidebar flottante repliable au-dessus d'un fond de carte vide.
- [ ] L'app charge les données au démarrage, sidebar conforme à la maquette (repli inclus)

### #11 — Liste des personnages `M` — dépend de #10
`CharacterCard` (bande relation, doré, œil conditionnel), `SearchBar`, `FilterDropdown` custom (race/relation/groupe), tri alphabétique, états vides.
- [ ] Recherche + filtres combinables en temps réel, rendu fidèle à la maquette

### #12 — Modale personnage + groupes `L` — dépend de #11
`ModalShell`, `CharacterModal` (tous les champs, validation partagée, suggestions anti-doublon en cours de saisie), `GroupsModal` (CRUD + création à la volée), `ConfirmDialog`, upload avatar (resize canvas → WebP 256px, flux création puis upload).
- [ ] Créer/éditer/supprimer une fiche de bout en bout, avec photo
- [ ] La saisie d'un nom/gameId existant propose la fiche correspondante

## Milestone 4 : Carte

### #13 — Carte Leaflet de base `M` — dépend de #10
Sourcing de l'image HQ de Skyrim, intégration `MapView.vue` (CRS.Simple, zoom/pan/bounds, instances hors réactivité cf. docs/leaflet-et-vue.md), utilitaires `coords.ts`.
- [ ] Carte fluide, bornée, conversions px ↔ LatLng testées

### #14 — POI : affichage + mode édition `M` — dépend de #13, #7
Étiquettes POI (visibilité selon zoom), toggle mode édition : clic = créer, drag = déplacer, renommer/supprimer. C'est aussi l'outil de calibrage initial.
- [ ] Calibrer ~20 POI réels de Skyrim via ce mode, persistés en base

### #15 — Pins personnages `L` — dépend de #13, #11
`pinIcon.ts` (avatar/« ? », couleur relation, plein vs pointillé), survol précis du cercle, mini-fiche popup au clic (placée selon l'espace), sync bidirectionnelle liste ↔ carte, toggles de visibilité, clic œil → centrage.
- [ ] Tous les comportements de sync du CDC §5.1/5.2 fonctionnels

### #16 — Mode placement `M` — dépend de #15, #12
Machine à états dans `ui.store.ts` : modale → carte (curseur croix) → clic → retour modale avec draft restauré + label du POI le plus proche. Suppression d'une position.
- [ ] Placer, replacer et supprimer les deux positions sans perdre la saisie en cours

## Milestone 5 : Finitions

### #17 — UI import/export `S` — dépend de #9, #10
Boutons export (téléchargement du bundle) et import (sélecteur de fichier + choix replace/merge + rechargement des stores).
- [ ] Cycle complet export → modification → import testé à la main

### #18 — Polish `S` — dépend de tout
Passe finale : Échap/clic-dehors partout, focus visible, `aria-label`/`title` complets, états vides et messages d'erreur, `npm run lint` strict, README (lancement, sauvegarde).
- [ ] Zéro warning ESLint, parcours complet au clavier possible
