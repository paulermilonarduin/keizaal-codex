import type { PoiType } from '../../shared/enums.ts'

// Capitale/ville restent toujours visibles (grands repères) ; les autres
// types n'apparaissent qu'une fois assez zoomé, pour éviter la surcharge
// visuelle des ~150 POI au dézoom maximal (cahier des charges §3).
const ALWAYS_VISIBLE: readonly PoiType[] = ['capitale', 'ville']
// Exporté : MapView en a besoin pour garantir un zoom où le POI ciblé est
// visible, plutôt que de redupliquer le « + 1 ».
export const ZOOM_THRESHOLD_ABOVE_MIN = 1

export function isPoiVisibleAtZoom(type: PoiType, zoom: number, minZoom: number): boolean {
  if (ALWAYS_VISIBLE.includes(type)) return true
  return zoom >= minZoom + ZOOM_THRESHOLD_ABOVE_MIN
}

// Zoom auquel centrer pour que le POI ciblé soit effectivement visible (#54) :
// sans ça, cliquer une grotte dans la liste au dézoom maximal centrerait la
// carte sur un marqueur masqué. Ne dézoome jamais — on ne recule pas une vue
// détaillée pour un POI qui y est déjà visible.
export function zoomToShowPoi(type: PoiType, currentZoom: number, minZoom: number): number {
  if (isPoiVisibleAtZoom(type, currentZoom, minZoom)) return currentZoom
  return minZoom + ZOOM_THRESHOLD_ABOVE_MIN
}
