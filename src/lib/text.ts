// Recherche et anti-doublon insensibles à la casse et aux accents.
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function match(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}

// Date courte JJ/MM pour l'affichage (position connue). Entrée : YYYY-MM-DD.
export function formatShortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}
