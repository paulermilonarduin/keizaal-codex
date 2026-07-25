# Codex Keizaal

Application web **locale et mono-utilisateur** de suivi des personnages rencontrés sur le serveur RP Skyrim [Keizaal](https://keizaal.com/fr) : fiches personnages dans une sidebar, carte de Skyrim interactive avec pins de position. Remplace des post-its.

## Statut

✅ Les 18 tickets du plan d'implémentation ([docs/BACKLOG.md](docs/BACKLOG.md)) sont livrés : fiches personnages, carte interactive (POI + pins + mode placement), groupes, export/import.

## Stack

| Côté | Techno |
|---|---|
| Front | Vue 3 + Vite + Pinia + Leaflet (`CRS.Simple`), TypeScript |
| Back | Node ≥ 24 natif (module `http`, router maison — pas de framework), TypeScript exécuté en type stripping |
| Stockage | SQLite via `node:sqlite`, avatars sur disque (`data/avatars/`) |
| Validation | Zod dans `shared/` — schémas = source unique des types (`z.infer`), le serveur est l'autorité |

## Prérequis

- **Node.js ≥ 24** (type stripping TypeScript natif + `node:sqlite`)

## Démarrage

Deux processus, dans deux terminaux :

```bash
npm install
npm start           # serveur Node : API + avatars (port 4750)
```

```bash
npm run dev         # front Vite (port 5173), proxy /api et /avatars → port 4750
```

Puis ouvrir http://localhost:5173.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Build de production (`dist/`) |
| `npm start` | Serveur Node (sert l'API + le front buildé) |
| `npm run electron` | Lance l'app desktop Electron en local (build + fenêtre) |
| `npm run dist:electron` | Build + package l'exécutable Windows portable (`release/`) |
| `npm test` | Typecheck (`tsc --noEmit`) puis tests `node:test` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Application desktop

`npm run dist:electron` produit un exécutable Windows autonome (`release/Codex Keizaal <version>.exe`, portable — pas d'installation) qui embarque le serveur et le front : double-clic, une fenêtre s'ouvre, aucun terminal ni navigateur à lancer à part.

Les données (base SQLite + avatars) vivent dans le dossier utilisateur (`%APPDATA%/keizaal-codex` sous Windows), pas dans le dossier de l'exécutable : elles survivent aux mises à jour de l'application.

## Releases

Onglet **Actions** du repo → workflow **Release** → **Run workflow** → choisir `patch`/`minor`/`major`. Le workflow bump la version, tague, teste, build l'exe et publie la [release GitHub](https://github.com/paulermilonarduin/keizaal-codex/releases) avec notes auto-générées. Détails et explications pas à pas : [docs/github-actions.md](docs/github-actions.md).

## Documentation

| Document | Rôle |
|---|---|
| [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md) | Fonctionnalités, modèle de données, API, UI |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Couches, flux de données, conventions, arborescence |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Plan d'implémentation (tickets ordonnés) |
| [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md) | Règles d'intégration Leaflet dans Vue 3 |
| [docs/github-actions.md](docs/github-actions.md) | Guide GitHub Actions : CI et pipeline de release |
| [design/mockup.html](design/mockup.html) | Maquette statique validée — source de vérité visuelle |

## Données

Tout vit en local : base SQLite + avatars, dans `data/` (dossier gitignoré) en mode `npm start`, ou dans le dossier utilisateur en application desktop (voir ci-dessus).

**Sauvegarde** : boutons « Exporter » / « Importer » en pied de la sidebar. L'export télécharge un fichier JSON autonome (`codex-keizaal-YYYY-MM-DD.json`, avatars inclus en base64) — à faire régulièrement, il tient lieu de sauvegarde lisible de toute la base. L'import recharge ce fichier avec un choix explicite entre **remplacer** tout ou **fusionner** (correspondance par `gameId`, sinon par id interne).
