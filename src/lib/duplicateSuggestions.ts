import { match } from './text.ts'
import type { Character } from '../../shared/schemas.ts'

const MIN_QUERY_LENGTH = 2

// Anti-doublon (cahier des charges §4/§5.3) : pendant la saisie du nom ou du
// gameId, propose les fiches existantes qui correspondent, pour compléter une
// fiche au lieu d'en créer une seconde sans le savoir.
export function findDuplicateSuggestions(
  characters: readonly Character[],
  query: { name?: string; gameId?: string },
  excludeId?: string,
): Character[] {
  const name = query.name?.trim() ?? ''
  const gameId = query.gameId?.trim() ?? ''
  const nameOk = name.length >= MIN_QUERY_LENGTH
  const gameIdOk = gameId.length >= MIN_QUERY_LENGTH
  if (!nameOk && !gameIdOk) return []

  return characters.filter((character) => {
    if (character.id === excludeId) return false
    const nameMatches = nameOk && character.name !== undefined && match(character.name, name)
    const gameIdMatches = gameIdOk && character.gameId !== undefined && match(character.gameId, gameId)
    return nameMatches || gameIdMatches
  })
}
