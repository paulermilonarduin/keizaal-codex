import type { Character, CharacterInput, Position } from '../../shared/schemas.ts'

// Stub de la phase rouge (#88).
export function movedCharacterInput(character: Character, position: Position): CharacterInput {
  return { name: character.name, position }
}
