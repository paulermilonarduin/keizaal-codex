import type { Poi } from '../../shared/schemas.ts'

// Pré-remplissage du label lors du placement d'un pin (CDC §5.1) : le POI le
// plus proche des coordonnées posées, ou null s'il n'y en a aucun.
export function nearestPoi(x: number, y: number, pois: readonly Poi[]): Poi | null {
  let closest: Poi | null = null
  let closestDistance = Infinity

  for (const poi of pois) {
    const distance = (poi.x - x) ** 2 + (poi.y - y) ** 2
    if (distance < closestDistance) {
      closestDistance = distance
      closest = poi
    }
  }

  return closest
}
