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
| `npm test` | Typecheck (`tsc --noEmit`) puis tests `node:test` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Documentation

| Document | Rôle |
|---|---|
| [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md) | Fonctionnalités, modèle de données, API, UI |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Couches, flux de données, conventions, arborescence |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Plan d'implémentation (tickets ordonnés) |
| [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md) | Règles d'intégration Leaflet dans Vue 3 |
| [design/mockup.html](design/mockup.html) | Maquette statique validée — source de vérité visuelle |

## Données

Tout vit en local : base SQLite `data/codex.db` + avatars dans `data/avatars/` (dossier gitignoré).

**Sauvegarde** : boutons « Exporter » / « Importer » en pied de la sidebar. L'export télécharge un fichier JSON autonome (`codex-keizaal-YYYY-MM-DD.json`, avatars inclus en base64) — à faire régulièrement, il tient lieu de sauvegarde lisible de toute la base. L'import recharge ce fichier avec un choix explicite entre **remplacer** tout ou **fusionner** (correspondance par `gameId`, sinon par id interne).
