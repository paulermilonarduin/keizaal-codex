import type { PoiType } from '../../shared/enums.ts'

// Capitale/ville gardent leur nom à tous les zooms (grands repères) ; les autres
// types ne l'affichent qu'une fois assez zoomé, pour éviter un empilement
// d'étiquettes illisible au dézoom (cahier des charges §3).
const ALWAYS_LABELLED: readonly PoiType[] = ['capitale', 'ville']
export const ZOOM_THRESHOLD_ABOVE_MIN = 1

// Depuis #68 le marqueur lui-même est toujours affiché : c'est l'icône du type
// qui porte l'information, et une carte quasi vide au dézoom n'avait pas de sens
// une fois le seed des ~150 POI retiré (#50). Seule l'étiquette reste
// conditionnelle — d'où le renommage de cette fonction.
export function isPoiLabelVisibleAtZoom(type: PoiType, zoom: number, minZoom: number): boolean {
  if (ALWAYS_LABELLED.includes(type)) return true
  return zoom >= minZoom + ZOOM_THRESHOLD_ABOVE_MIN
}
