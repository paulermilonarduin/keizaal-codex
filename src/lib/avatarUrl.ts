import type { Character } from '../../shared/schemas.ts'

// Cache-buster (#108) : le chemin d'un avatar est stable (`avatars/<id>.webp`)
// alors que son contenu change à chaque remplacement. Sans le `?v=`, ni le
// navigateur ni le DOM ne voient de raison de recharger l'image, et l'ancienne
// reste affichée. `updatedAt` est bumpé par le serveur à chaque upload/suppression.
export function avatarUrl(character: Pick<Character, 'avatar' | 'updatedAt'>): string | null {
  if (character.avatar === undefined) return null
  return `/${character.avatar}?v=${encodeURIComponent(character.updatedAt)}`
}
