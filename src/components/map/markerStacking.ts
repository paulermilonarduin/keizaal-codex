// Ordre d'empilement des marqueurs sur la carte (#82).
//
// Leaflet écrit lui-même un z-index sur le wrapper `.leaflet-marker-icon`,
// dérivé de la latitude : le marqueur le plus au sud passe devant. Un z-index
// posé en CSS sur un enfant de ce wrapper ne peut rien y changer, puisqu'un
// enfant ne sort jamais son parent de l'ordre de ses frères. La seule prise est
// `marker.setZIndexOffset()`, qui s'ajoute au z-index calculé.

export interface MarkerState {
  hovered: boolean
  selected: boolean
}

export const Z_OFFSET_NORMAL = 0
export const Z_OFFSET_SELECTED = 1000
export const Z_OFFSET_HOVERED = 2000

// Les paliers sont volontairement larges : le z-index de base vient de la
// latitude en pixels et atteint plusieurs milliers aux zooms élevés. Un écart
// trop faible laisserait un marqueur au sud devant un marqueur survolé situé
// plus au nord.
//
// Le survol prime sur la sélection : c'est une action en cours, alors que la
// sélection est un état qui dure.
export function markerZOffset({ hovered, selected }: MarkerState): number {
  if (hovered) return Z_OFFSET_HOVERED
  if (selected) return Z_OFFSET_SELECTED
  return Z_OFFSET_NORMAL
}
