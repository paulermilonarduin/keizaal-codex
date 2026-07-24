import type { Character } from '../../../shared/schemas.ts'

export type PinKind = 'home' | 'known'

export interface PinIconOptions {
  active: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Fabrique le HTML d'un pin personnage (cf. CDC §5.1) : position connue en
// pointillés (`is-known`), couleur de bordure = relation, survol/sélection
// partagés avec la sidebar (`is-active`). Pure : données → string, testable
// sans DOM (docs/leaflet-et-vue.md, ARCHITECTURE.md §5.3).
export function buildPinIcon(character: Character, kind: PinKind, options: PinIconOptions): string {
  const label = character.name ?? character.gameId ?? ''
  const classes = ['pin', `rel-${character.relation}`]
  if (kind === 'known') classes.push('is-known')
  if (options.active) classes.push('is-active')

  const avatarHtml =
    character.avatar !== undefined
      ? `<img src="/${escapeHtml(character.avatar)}" alt="" />`
      : '<span class="pin__fallback">?</span>'

  return `<div class="${classes.join(' ')}"><div class="pin__ring">${avatarHtml}</div><div class="pin__tail"></div><div class="pin__label">${escapeHtml(label)}</div></div>`
}
