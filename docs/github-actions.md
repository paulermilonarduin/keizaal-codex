# GitHub Actions — comprendre les workflows du projet

Guide de découverte : ce que fait GitHub Actions, comment lire nos deux
workflows, et comment sortir une release en deux clics.

## 1. C'est quoi, GitHub Actions ?

Des machines jetables que GitHub démarre pour toi quand il se passe quelque
chose dans le dépôt. Tu décris dans un fichier YAML « quand tel événement
arrive, exécute telles commandes sur telle machine » ; GitHub s'occupe du
reste : provisionner la machine, cloner le repo, exécuter, afficher les logs,
jeter la machine.

Le vocabulaire, du plus grand au plus petit :

| Terme | C'est... | Chez nous |
|---|---|---|
| **Workflow** | Un fichier YAML dans `.github/workflows/` | `ci.yml`, `release.yml` |
| **Événement** (`on:`) | Ce qui déclenche le workflow | PR ouverte, tag poussé, bouton cliqué |
| **Job** | Un groupe d'étapes sur une machine donnée | `test`, `release` |
| **Runner** (`runs-on:`) | La machine jetable | `ubuntu-latest`, `windows-latest` |
| **Step** | Une commande (`run:`) ou une action toute faite (`uses:`) | `npm test`, `actions/checkout@v4` |

Deux sortes de steps :

- `run:` — une commande shell, comme si tu la tapais dans un terminal sur la
  machine jetable.
- `uses:` — une **action** réutilisable publiée par quelqu'un (un peu comme un
  package npm, mais pour le CI). `actions/checkout@v4` clone le repo,
  `actions/setup-node@v4` installe Node. Le `@v4` épingle la version.

Tout se regarde dans l'onglet **Actions** du repo : chaque exécution (« run »)
y apparaît avec ses logs, étape par étape, en direct.

## 2. `ci.yml` — le filet de sécurité

```yaml
on:
  pull_request:          # chaque PR (ouverture + chaque push dessus)
  push:
    branches: [main]     # et chaque merge sur main
```

À chaque déclenchement : machine Linux neuve → clone → Node 24 → `npm ci` →
`npm test` → `npm run lint`. Si une étape échoue, la PR affiche une croix
rouge à côté du commit.

Deux détails qui comptent :

- **`npm ci`** (et pas `npm install`) : installe *exactement* ce que
  `package-lock.json` décrit, ou échoue. Reproductible, et plus rapide.
- **Pourquoi c'est précieux ici** : ça garantit que `main` est releasable à
  tout moment. Le jour — peut-être des mois après la dernière release — où tu
  cliques sur le bouton, tu sais que tu pars du vert, pas de « ça marchait
  sur ma machine ».

## 3. `release.yml` — la sortie de version

Deux déclencheurs pour le même job :

```yaml
on:
  push:
    tags: ['v*']         # pousser un tag v1.2.3 à la main
  workflow_dispatch:     # OU le bouton « Run workflow » dans l'onglet Actions
    inputs:
      bump: ...          # menu déroulant patch / minor / major
```

`workflow_dispatch` = « déclenchable à la main depuis l'interface GitHub »,
avec des champs de formulaire (ici le type de bump [SemVer](https://semver.org/lang/fr/) :
`patch` 0.1.0→0.1.1 pour des correctifs, `minor` 0.1.0→0.2.0 pour des
nouveautés, `major` 0.1.0→1.0.0 pour un changement de rupture).

Le job, sur une machine **Windows** (l'exe est un binaire Windows) :

1. **Bump** *(bouton seulement)* : `npm version patch|minor|major` incrémente
   `package.json`, committe et crée le tag `vX.Y.Z` d'un coup, puis
   `git push --follow-tags` envoie les deux sur `main`.
2. **Garde-fou** *(tag manuel seulement)* : vérifie que le tag poussé
   correspond à la version de `package.json`, sinon échec immédiat — l'exe ne
   doit jamais afficher un numéro différent de sa propre release.
3. `npm ci` → `npm test` : pas de release si les tests sont rouges.
4. `npm run dist:electron` : build du front puis packaging de l'exe portable.
5. `gh release create "v$VERSION" --generate-notes <exe>` : crée la release
   GitHub, avec des **notes rédigées automatiquement** (la liste des PR
   mergées depuis la release précédente) et l'exe en pièce jointe.

### Les trois notions « invisibles » à connaître

- **`GITHUB_TOKEN`** : un jeton d'authentification que GitHub fabrique
  automatiquement pour chaque run (personne ne le crée ni ne le stocke). On le
  passe à `gh` via `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
- **`permissions:`** : par défaut ce jeton est en lecture seule. Notre
  `contents: write` l'autorise à pousser le commit de bump, le tag, et créer
  la release — et rien d'autre (pas les settings, pas les autres repos).
- **L'anti-boucle** : un événement produit *avec* le `GITHUB_TOKEN` (comme
  notre tag poussé à l'étape 1) ne déclenche **pas** d'autres workflows.
  C'est voulu par GitHub (sinon : tag → workflow → tag → workflow → ∞). C'est
  pour ça que le bouton fait tout dans la même exécution au lieu de pousser
  un tag et d'attendre que le déclencheur `tags:` prenne le relais.

## 4. Mode d'emploi : sortir une release

1. Onglet **Actions** du repo → workflow **Release** (colonne de gauche).
2. Bouton **Run workflow** → choisir `patch`, `minor` ou `major` → **Run**.
3. Attendre ~5-10 min (suivre les logs en cliquant sur le run si curieux).
4. La release est sur `https://github.com/paulermilonarduin/keizaal-codex/releases`
   avec l'exe en pièce jointe et les notes générées.
5. En local, penser à `git pull` : le bump de version est un commit sur `main`.

L'alternative « à l'ancienne » reste possible : bump manuel de `package.json`,
commit, puis `git tag v1.2.3 && git push origin v1.2.3` — même résultat via le
déclencheur `tags:`.

## 5. Quand un run échoue

- Onglet **Actions** → cliquer le run rouge → cliquer le job → l'étape rouge
  est dépliée avec ses logs complets.
- Le bouton **Re-run failed jobs** relance sans re-déclencher l'événement.
- Cas typiques : test cassé (le log est le même que `npm test` en local),
  ou — pour le bouton release — un état de `main` qui a bougé entre-temps.

## 6. Combien ça coûte ?

Le repo est **public** : les runners standards (Linux, Windows, macOS) sont
gratuits et illimités. (Sur un repo privé, ce serait un quota de minutes
mensuel, avec les minutes Windows comptées double — bon à savoir si le repo
change un jour de visibilité.)
