// Redimensionnement client de l'avatar avant upload (~256px, WebP). Seule
// brique du projet non testable en Node (canvas/Image n'existent pas côté
// serveur) — reste volontairement minuscule, cf. ARCHITECTURE.md §7.
const MAX_SIZE = 256

export async function resizeToWebp(file: File, maxSize = MAX_SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Contexte canvas 2D indisponible')
  context.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Échec de conversion WebP'))
      else resolve(blob)
    }, 'image/webp', 0.9)
  })
}
