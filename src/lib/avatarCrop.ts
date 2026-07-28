// Géométrie du recadrage d'avatar (#97), en pixels d'image native. Volontairement
// pur : aucun import de vue-advanced-cropper ni de type DOM, pour que tout le
// calcul reste testable sous node:test (cf. ARCHITECTURE.md §7).
export type Size = { width: number; height: number }
export type CropBox = { left: number; top: number; width: number; height: number }

// Zoom maximal : le carré de crop peut descendre à 1/10 du cadrage initial.
export const MAX_ZOOM = 10
// En dessous, la zone recadrée serait trop pauvre pour l'avatar final (256px).
export const MIN_CROP_SIDE_PX = 32

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Zoom minimal : le plus grand carré qui tienne dans l'image.
export function initialCropSide(image: Size): number {
  return Math.min(image.width, image.height)
}

// Zoom maximal, jamais plus serré que le plancher ni plus large que le cadrage
// initial (cas des images plus petites que le plancher).
export function minCropSide(image: Size): number {
  const initial = initialCropSide(image)
  return Math.min(initial, Math.max(initial / MAX_ZOOM, MIN_CROP_SIDE_PX))
}

export function initialCoordinates(image: Size): CropBox {
  const side = initialCropSide(image)
  return {
    left: Math.round((image.width - side) / 2),
    top: Math.round((image.height - side) / 2),
    width: side,
    height: side,
  }
}

// Amplitude de zoom disponible, en pixels de côté. Nulle sur une image sans
// marge (initial === minimum) : les deux conversions doivent la traiter à part
// pour ne pas produire de NaN.
function zoomSpan(image: Size): number {
  return initialCropSide(image) - minCropSide(image)
}

export function sliderValueFor(cropSide: number, image: Size): number {
  const span = zoomSpan(image)
  if (span <= 0) return 0
  return clamp((initialCropSide(image) - cropSide) / span, 0, 1)
}

export function cropSideFor(sliderValue: number, image: Size): number {
  return initialCropSide(image) - clamp(sliderValue, 0, 1) * zoomSpan(image)
}
