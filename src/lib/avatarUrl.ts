import type { Character } from '../../shared/schemas.ts'

// Stub de la phase rouge (#108) : l'implémentation arrive au commit suivant.
export function avatarUrl(character: Pick<Character, 'avatar' | 'updatedAt'>): string | null {
  void character
  throw new Error('not implemented')
}
