// Le placement est un mode modal (#86) : tant qu'il est actif, la carte
// entière appartient au clic de pose. Ces deux fonctions sont pures pour être
// testables sans DOM (docs/leaflet-et-vue.md, ARCHITECTURE.md §5.3), MapView
// ne fait que les brancher.

// Classes du conteneur Leaflet. Le modificateur `--placing` porte la règle CSS
// qui rend les marqueurs transparents à la souris : sans lui, le curseur
// `pointer` de .pin__ring l'emporte sur le crosshair du conteneur, et le clic
// est consommé par le marqueur au lieu d'atteindre le handler de la carte,
// ce qui rendait impossible de poser une position sur un pin existant.
export function mapContainerClasses(placementActive: boolean): string[] {
  const classes = ['map-container']
  if (placementActive) classes.push('map-container--placing')
  return classes
}

export type EscapeAction = 'cancel-placement' | 'close-popup' | null

// Priorité d'Échap : le placement d'abord, la mini-fiche ensuite. Une
// mini-fiche peut rester ouverte pendant un placement, Échap doit alors
// annuler le placement et pas fermer la mauvaise chose.
export function escapeAction(state: {
  placementActive: boolean
  popupOpen: boolean
}): EscapeAction {
  if (state.placementActive) return 'cancel-placement'
  if (state.popupOpen) return 'close-popup'
  return null
}
