import MarkdownIt from 'markdown-it'

// `html: false` échappe tout HTML brut présent dans le body de la release : la
// sortie est intégralement produite par le renderer, donc sûre à injecter via
// v-html sans passer par un sanitizer.
const md = new MarkdownIt({ html: false, linkify: true })

// Pattern documenté par markdown-it : on garde la règle d'origine (ici le
// rendu de token par défaut) et on se contente d'ajouter des attributs.
const defaultLinkOpen: NonNullable<typeof md.renderer.rules.link_open> =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

// Les liens d'un patch note pointent tous vers l'extérieur. Dans l'exe, une
// navigation en place remplacerait l'app par la page GitHub : `target=_blank`
// les fait passer par setWindowOpenHandler, donc par le navigateur système.
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token?.attrSet('target', '_blank')
  token?.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderReleaseNotes(source: string): string {
  return md.render(source)
}
