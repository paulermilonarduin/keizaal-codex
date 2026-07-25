// Géométrie de la vue carte, en fonctions pures : testables sans DOM ni
// Leaflet, contrairement à `map.getBoundsZoom()` — qui, en plus, **clampe son
// résultat au minZoom courant** (leaflet-src.js : `Math.max(min, …)`). Le
// recalculer avec lui ne fonctionnerait donc que quand le conteneur grandit,
// jamais quand il rétrécit (#55).

export const ABSOLUTE_MIN_ZOOM = -5
export const MAX_ZOOM = 4

type Size = { width: number; height: number }

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(ABSOLUTE_MIN_ZOOM, zoom))
}

// Zoom auquel l'image tient ENTIÈRE dans le conteneur. En CRS.Simple avec
// zoomSnap 0, les bounds projetés valent exactement les dimensions de l'image :
// le zoom de fit est donc le log2 du plus contraignant des deux ratios.
export function fitZoom(container: Size, image: Size): number {
  if (container.width <= 0 || container.height <= 0) return ABSOLUTE_MIN_ZOOM
  const scale = Math.min(container.width / image.width, container.height / image.height)
  return clampZoom(Math.log2(scale))
}

// Tolérance de comparaison des zooms : large devant la dérive flottante,
// négligeable à l'œil (0.001 de zoom ≈ 0,07 % de taille).
const ZOOM_EPSILON = 1e-3

// Après un redimensionnement, le plancher de zoom bouge. Que devient la vue ?
export function zoomAfterResize(current: number, previousMin: number, nextMin: number): number {
  // L'utilisateur était au dézoom maximal : « je vois toute la carte » est une
  // intention, pas une coordonnée — on la préserve en suivant le nouveau
  // plancher (sinon agrandir la fenêtre laisserait des marges vides).
  if (Math.abs(current - previousMin) < ZOOM_EPSILON) return nextMin
  // Sinon on garde son zoom, simplement relevé si le plancher le dépasse.
  return Math.max(current, nextMin)
}
