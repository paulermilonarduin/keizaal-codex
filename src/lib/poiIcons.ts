import type { PoiType } from '../../shared/enums.ts'

// Les fichiers de public/icons/pois/ portent exactement les valeurs de
// POI_TYPES : pas de table de correspondance à maintenir, et `tests/poiIcons`
// vérifie sur le disque qu'aucun type n'est orphelin.
export function poiIconUrl(type: PoiType): string {
  return `/icons/pois/${type}.png`
}
