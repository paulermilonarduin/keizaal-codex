---
name: new-issue
description: Rédige et crée une issue GitHub après des questions de cadrage. Invocation manuelle uniquement.
argument-hint: "[description du besoin]"
disable-model-invocation: true
model: sonnet
effort: high
---

Tu rédiges une issue GitHub à partir du besoin exprimé par Paul. Ton objectif : une issue si bien cadrée que l'implémentation ne demandera aucune décision improvisée. Tu ne codes RIEN dans ce flux.

## Étapes

1. **Comprendre le contexte.** Lis les issues récentes du repo courant (`gh issue list`, puis `gh issue view` sur 2 ou 3 exemples) pour reprendre leur style, leur structure et leur niveau de détail. Dans keizaal-codex, le style est : sections `## Besoin` (ou `## Symptôme` pour un bug), `## Ce qui existe déjà et sur quoi s'appuyer`, `## Points à trancher avant implémentation`, `## Portée technique prévisible`, `## Critères d'acceptation` (cases à cocher, toujours finir par lint et tests verts). Explore le code concerné pour ancrer l'issue techniquement : fichiers réels, mécanismes existants, pièges connus.
2. **Anti-doublon.** Cherche dans les issues ouvertes ET fermées si le sujet existe déjà ou le recoupe. Si oui, le signaler avant tout.
3. **Poser les questions de cadrage** via AskUserQuestion, en une ou plusieurs vagues courtes. Ne demande que ce qui change réellement le contenu de l'issue : périmètre, comportements ambigus, choix UX ou données. Ce que le code ou les conventions du repo permettent de déduire, déduis-le. Les questions ouvertes légitimes mais non bloquantes vont dans « Points à trancher avant implémentation ».
4. **Proposer le brouillon complet** de l'issue (titre + corps) dans la conversation et attendre la validation explicite de Paul. Intègre ses retours autant de tours que nécessaire.
5. **Créer l'issue** une fois validée, avec `gh issue create`.

## Règles

- Issue rédigée en **français**, sans tiret cadratin, technique mais orientée « pourquoi » : le lecteur dans 6 mois doit comprendre les décisions.
- Compte GitHub : respecter l'identité propre au repo courant. Dans keizaal-codex (repo perso), préfixer chaque commande par `GH_TOKEN=$(gh auth token --hostname github.com --user paulermilonarduin)` et ne JAMAIS faire `gh auth switch` (cf. mémoire keizaal-codex-identite-github).
- Ne jamais élargir : une demande = une issue. Si le cadrage révèle deux sujets distincts, le dire et proposer deux issues.
- Ne pas implémenter, ne pas créer de branche, ne pas committer.
