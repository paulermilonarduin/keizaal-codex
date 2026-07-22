// Conversions pixels image (origine haut-gauche, Y vers le bas) ↔ LatLng
// Leaflet CRS.Simple. Bounds calées en [[-imageHeight, 0], [0, imageWidth]] :
// l'axe Y pointe donc vers le bas avec des valeurs négatives (docs/leaflet-et-vue.md §5),
// aucun décalage de hauteur à connaître ici.
export function pixelToLatLng(x: number, y: number): [number, number] {
  return [-y || 0, x] // `|| 0` évite un -0 quand y vaut 0
}

export function latLngToPixel(lat: number, lng: number): { x: number; y: number } {
  return { x: lng, y: -lat || 0 }
}
