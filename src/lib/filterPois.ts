import { match } from './text.ts'
import type { Poi } from '../../shared/schemas.ts'
import type { PoiType } from '../../shared/enums.ts'

export type PoiFilterCriteria = {
  search: string
  type: PoiType | null
}

// Miroir de filterCharacters : recherche sur le nom (seul champ textuel d'un
// POI), filtre de type combinable, tri alphabétique français.
export function filterPois(pois: readonly Poi[], criteria: PoiFilterCriteria): Poi[] {
  const searched = criteria.search.trim()

  const filtered = pois.filter((poi) => {
    if (criteria.type !== null && poi.type !== criteria.type) return false
    if (searched === '') return true
    return match(poi.name, searched)
  })

  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
