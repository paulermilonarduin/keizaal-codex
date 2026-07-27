import { poiIconUrl } from '../../lib/poiIcons.ts'
import type { PoiType } from '../../../shared/enums.ts'
import type { Poi } from '../../../shared/schemas.ts'

// Taille du repère en pixels. Elle vit ici et non plus dans le CSS : c'est la
// même valeur qui alimente la variable `--poi-size` du glyphe et l'ancrage
// donné à Leaflet, donc les deux ne peuvent plus diverger (#81).
export const POI_GLYPH_SIZE = 16
export const POI_GLYPH_SIZE_MAJOR = 20

export interface PoiMarkerOptions {
  labelled: boolean
  editable: boolean
  hovered: boolean
}

// La taille ne dépend que du type. L'agrandissement au survol est un `scale`
// CSS (#82) : c'est la seule façon de l'animer, et surtout cela garde la boîte
// constante, donc l'ancrage aussi. Le faire varier ici obligerait à recalculer
// iconSize/iconAnchor à chaque survol, au risque de décaler le repère et de
// rouvrir #81.
export function poiGlyphSize(type: PoiType): number {
  return type === 'capitale' ? POI_GLYPH_SIZE_MAJOR : POI_GLYPH_SIZE
}

// Boîte carrée de la taille du glyphe, ancrée en son centre : le repère couvre
// exactement le point. L'étiquette est hors du flux, elle n'entre donc pas dans
// la boîte et n'a plus d'effet sur l'ancrage, ce qui faisait sauter le repère
// quand elle apparaissait au franchissement du seuil de zoom.
export function poiIconGeometry(type: PoiType): {
  size: [number, number]
  anchor: [number, number]
} {
  const size = poiGlyphSize(type)
  return { size: [size, size], anchor: [size / 2, size / 2] }
}

// Échappement sans DOM (contrairement à l'ancienne version dans MapView, qui
// passait par document.createElement) : la fonction reste pure et testable
// sous node:test, cf. ARCHITECTURE.md §5.3.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// `labelled` ne masque que le nom : le repère, lui, est toujours rendu (#68).
// L'icône est posée en mask-image pour être teintée par le CSS, ce qui garde
// une seule source de couleur pour les POI.
export function buildPoiMarkerHtml(poi: Poi, options: PoiMarkerOptions): string {
  const classes = ['poi-marker']
  if (poi.type === 'capitale') classes.push('is-major')
  if (options.editable) classes.push('is-editable')
  if (options.hovered) classes.push('is-hovered')

  const label = options.labelled ? `<span class="poi-label">${escapeHtml(poi.name)}</span>` : ''
  const style = `--poi-icon: url('${poiIconUrl(poi.type)}'); --poi-size: ${poiGlyphSize(poi.type)}px`

  return `<div class="${classes.join(' ')}" style="${style}"><span class="poi-glyph"></span>${label}</div>`
}
