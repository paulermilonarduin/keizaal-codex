---
name: start-issue
description: Lance une issue GitHub de bout en bout : plan d'implémentation borné (mode plan), puis, à la validation, implémentation TDD jusqu'à la PR par l'agent implementer. Invocation manuelle uniquement.
argument-hint: "[n° issue]"
disable-model-invocation: true
model: fable
effort: high
---

Tu prépares l'implémentation d'une issue GitHub. Ta sortie est un plan-contrat validé par Paul, exécuté ensuite par un agent séparé (`implementer`, sur Opus) qui n'aura AUCUN autre contexte que ce contrat : tout ce qui n'y est pas écrit sera perdu.

## Étapes

1. **Lire l'issue** (`gh issue view <n°>`, commentaires compris) et explorer le code réellement concerné : fichiers, tests existants, conventions locales, tickets liés cités dans l'issue.
2. **Passer en mode plan** (EnterPlanMode) et produire le plan. Si l'issue contient des « Points à trancher avant implémentation », les résoudre avec Paul (AskUserQuestion) AVANT de finaliser le plan : le contrat ne doit contenir aucune question ouverte.
3. **À la validation du plan** (ExitPlanMode approuvé) :
   - Écrire le contrat complet dans `~/.claude/plans/<nom-du-repo>/issue-<n°>.md` (créer les dossiers si besoin, UTF-8 sans BOM, LF) : archive personnelle, hors du repo, donc jamais dans un git status.
   - Lancer l'agent `implementer` via le tool Agent (subagent_type: implementer) en passant dans le prompt : le n° d'issue, ET le contenu intégral du contrat (le worktree de l'agent ne contiendra pas le fichier non commité).
   - Relayer à Paul le résultat de l'agent (lien de PR ou blocage) quand il termine.

## Structure du contrat (toutes sections obligatoires)

- `## Objectif` : reformulation en 2 ou 3 phrases, avec le lien de l'issue.
- `## Scope autorisé` : liste exhaustive des fichiers à créer ou modifier. L'implémenteur ne touche RIEN d'autre.
- `## Hors scope explicite` : ce qu'on pourrait être tenté de faire et qu'on ne fait pas (refactors voisins, bugs croisés en route : signaler, ne pas corriger).
- `## Tests à écrire` : la liste nominative des cas de test (nom du fichier de test, comportement vérifié par cas), rédigée assez précisément pour être écrite telle quelle en phase rouge. Suivre l'idiome du repo (dans keizaal-codex : modules purs testés via node:test, sans DOM).
- `## Étapes` : ordre d'implémentation, avec les points de commit (tests rouges, implémentation verte, refactor éventuel).
- `## Critères de sortie` : critères d'acceptation de l'issue + lint et tests verts + PR créée.
- `## Pièges connus` : tout ce que l'exploration a révélé (régressions passées citées dans le code, couplages non évidents, décisions du CLAUDE.md projet qui s'appliquent).

## Règles

- Le plan doit être exécutable de bout en bout sans poser de question : chaque décision est prise ici, pas pendant l'implémentation.
- Ne pas élargir le scope de l'issue. Une idée en cours de route = proposer une nouvelle issue, pas l'ajouter au plan.
- Compte GitHub : respecter l'identité propre au repo courant. Dans keizaal-codex : `GH_TOKEN=$(gh auth token --hostname github.com --user paulermilonarduin)` pour les commandes gh, jamais de `gh auth switch`.
- Conversation en français ; le contrat peut citer du code et des identifiants en anglais.
