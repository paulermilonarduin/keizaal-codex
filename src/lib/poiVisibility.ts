import type { PoiType } from '../../shared/enums.ts'

// Capitale/ville restent toujours visibles (grands repères) ; les autres
// types n'apparaissent qu'une fois assez zoomé, pour éviter la surcharge
// visuelle des ~150 POI au dézoom maximal (cahier des charges §3).
const ALWAYS_VISIBLE: readonly PoiType[] = ['capitale', 'ville']
const ZOOM_THRESHOLD_ABOVE_MIN = 1

export function isPoiVisibleAtZoom(type: PoiType, zoom: number, minZoom: number): boolean {
  if (ALWAYS_VISIBLE.includes(type)) return true
  return zoom >= minZoom + ZOOM_THRESHOLD_ABOVE_MIN
}
