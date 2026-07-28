import type { Character } from '../../../shared/schemas.ts'

export interface PinIconOptions {
  active: boolean
  // Mode édition des personnages (#88) : ne change que le curseur, la géométrie
  // du pin reste identique pour ne pas rouvrir #81.
  editable: boolean
}

// Dimensions du pin en pixels, à garder synchronisées avec le CSS de
// MapView.vue (`.pin__ring`, `.pin__tail`). Ce couplage est assumé, comme
// POPUP_WIDTH/POPUP_HEIGHT : c'est le prix d'un iconSize/iconAnchor exact,
// seul moyen d'ancrer un marqueur au pixel à tous les zooms (#81).
export const PIN_RING_SIZE = 34
const PIN_TAIL_HEIGHT = 7
// La queue remonte d'un pixel sous le cercle pour masquer la jointure.
const PIN_TAIL_OVERLAP = 1

export const PIN_WIDTH = PIN_RING_SIZE
export const PIN_HEIGHT = PIN_RING_SIZE + PIN_TAIL_HEIGHT - PIN_TAIL_OVERLAP

// Géométrie donnée à Leaflet. L'ancre est la pointe de la queue (en bas,
// centrée) : c'est elle qui doit tomber sur la position du personnage.
// Constante par construction : l'étiquette est hors du flux, elle n'entre donc
// pas dans la boîte, et deux personnages aux noms de longueurs différentes
// s'ancrent exactement pareil.
export function pinIconGeometry(): { size: [number, number]; anchor: [number, number] } {
  return { size: [PIN_WIDTH, PIN_HEIGHT], anchor: [PIN_WIDTH / 2, PIN_HEIGHT] }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Fabrique le HTML d'un pin personnage (cf. CDC §5.1) : bordure pleine dont la
// couleur code la relation, survol/sélection partagés avec la sidebar
// (`is-active`). Pure : données → string, testable sans DOM
// (docs/leaflet-et-vue.md, ARCHITECTURE.md §5.3).
export function buildPinIcon(character: Character, options: PinIconOptions): string {
  const label = character.name ?? character.gameId ?? ''
  const classes = ['pin', `rel-${character.relation}`]
  if (options.active) classes.push('is-active')
  if (options.editable) classes.push('is-editable')

  const avatarHtml =
    character.avatar !== undefined
      ? `<img src="/${escapeHtml(character.avatar)}" alt="" />`
      : '<span class="pin__fallback">?</span>'

  // `pin__mark` regroupe le cercle et la queue pour que l'agrandissement au
  // survol (#82) porte sur eux seuls, depuis la pointe : l'étiquette reste hors
  // du groupe, donc elle ne double pas de taille et garde sa place sous la
  // pointe. Sans ce niveau, il faudrait agrandir tout le pin, étiquette
  // comprise, ou agrandir le cercle en laissant la queue derrière.
  return `<div class="${classes.join(' ')}"><div class="pin__mark"><div class="pin__ring">${avatarHtml}</div><div class="pin__tail"></div></div><div class="pin__label">${escapeHtml(label)}</div></div>`
}
