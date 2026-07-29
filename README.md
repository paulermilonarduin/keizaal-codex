<p align="center">
  <img src="build/logo.svg" alt="Codex Keizaal" width="300">
</p>

<p align="center">
  Un carnet de bord pour le jeu de rôle sur le serveur Skyrim <a href="https://keizaal.com/fr">Keizaal</a>.<br>
  Application <strong>locale et mono-utilisateur</strong>, qui remplace une pile de post-its.
</p>

## À quoi ça sert

En RP, on croise beaucoup de monde. On oublie qui était qui, qui traîne avec qui, où on avait vu untel, et ce qu'on s'était promis de lui demander la prochaine fois. Cette application garde tout ça au même endroit, à portée d'un second écran pendant qu'on joue.

### Suivre les personnages rencontrés

Une fiche par personnage, avec le strict nécessaire et rien d'obligatoire au-delà de son identité :

- **Nom, `#ID` en jeu, ou les deux.** Les trois cas réels sont couverts : croisé sans présentation (l'ID seul), présenté (les deux), ou simplement entendu parler (le nom seul).
- **Race, rôle, relation** (ami, neutre, ennemi, inconnu). La relation colore la fiche et son pin sur la carte, pour repérer un ennemi d'un coup d'œil.
- **Photo de profil**, redimensionnée automatiquement.
- **Note en texte libre**, l'endroit où vit vraiment la mémoire des rencontres : ce qu'il a raconté, ce qu'on lui doit, quand on l'a vu.
- **Suggestion anti-doublon** à la saisie : taper un nom ou un ID déjà connu propose la fiche existante, pour la compléter au lieu d'en créer une seconde.

Recherche instantanée sur le nom, l'ID, le rôle et la note, et filtres cumulables par race, relation et groupe.

### Regrouper en factions

Les groupes sont une liste partagée que l'on enrichit au fil des rencontres : nom, couleur, description. Un personnage peut appartenir à plusieurs groupes, et un groupe se crée à la volée depuis une fiche. Supprimer un groupe ne supprime jamais ses membres.

### Situer les lieux et les gens sur la carte

La carte de Skyrim est interactive et sert de mémoire spatiale :

- **Vos propres lieux.** Aucun lieu n'est fourni d'avance : on place ses points d'intérêt à la main, avec un type parmi une vingtaine (capitale, village, fort, mine, ruine nordique, sanctuaire, camp de géants...) qui donne son icône au repère. Le mode édition permet de les créer, déplacer, renommer.
- **La position des personnages.** Chaque fiche peut porter une position, posée d'un clic sur la carte. Le pin affiche la photo du personnage et la couleur de sa relation.
- **Liste et carte synchronisées.** Survoler une fiche éclaire son pin et inversement, cliquer un pin ouvre sa mini-fiche et surligne la fiche dans la liste, et l'icône en forme d'œil recentre la carte sur le personnage.

### Prendre des notes hors fiches

Un panneau de notes générales, toujours accessible, pour ce qui n'appartient à personne en particulier : rumeurs, questions en suspens, choses à faire au prochain passage. Il s'enregistre tout seul pendant la frappe.

### Ne rien perdre

Un bouton d'export produit un fichier JSON autonome qui contient absolument tout, photos comprises. C'est la sauvegarde. L'import le relit, en remplaçant tout ou en fusionnant avec l'existant.

## Stack

| Côté | Techno |
|---|---|
| Front | Vue 3 + Vite + Pinia + Leaflet (`CRS.Simple`), TypeScript |
| Back | Node ≥ 24 natif (module `http`, router maison, pas de framework), TypeScript exécuté en type stripping |
| Stockage | SQLite via `node:sqlite`, avatars sur disque (`data/avatars/`) |
| Validation | Zod dans `shared/` : schémas = source unique des types (`z.infer`), le serveur est l'autorité |

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

`npm run dist:electron` produit un exécutable Windows autonome (`release/Codex Keizaal <version>.exe`, portable, pas d'installation) qui embarque le serveur et le front : double-clic, une fenêtre s'ouvre, aucun terminal ni navigateur à lancer à part.

Les données (base SQLite + avatars) vivent dans le dossier utilisateur (`%APPDATA%/keizaal-codex` sous Windows), pas dans le dossier de l'exécutable : elles survivent aux mises à jour de l'application.

## Releases

Onglet **Actions** du repo → workflow **Release** → **Run workflow** → choisir `patch`/`minor`/`major`. Le workflow bump la version, tague, teste, build l'exe et publie la [release GitHub](https://github.com/paulermilonarduin/keizaal-codex/releases) avec notes auto-générées. Détails et explications pas à pas : [docs/github-actions.md](docs/github-actions.md).

## Documentation

| Document | Rôle |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Couches, flux de données, conventions, arborescence |
| [docs/leaflet-et-vue.md](docs/leaflet-et-vue.md) | Règles d'intégration Leaflet dans Vue 3 |
| [docs/github-actions.md](docs/github-actions.md) | Guide GitHub Actions : CI et pipeline de release |
| [design/mockup.html](design/mockup.html) | Maquette statique validée : source de vérité visuelle |

## Données

Tout vit en local : base SQLite + avatars, dans `data/` (dossier gitignoré) en mode `npm start`, ou dans le dossier utilisateur en application desktop (voir ci-dessus).

**Sauvegarde** : boutons « Exporter » / « Importer » en pied de la sidebar. L'export télécharge un fichier JSON autonome (`codex-keizaal-YYYY-MM-DD.json`, avatars inclus en base64), à faire régulièrement, il tient lieu de sauvegarde lisible de toute la base. L'import recharge ce fichier avec un choix explicite entre **remplacer** tout ou **fusionner** (correspondance par `gameId`, sinon par id interne).
