import { match } from './text.ts'
import type { Character } from '../../shared/schemas.ts'
import type { Race, Relation } from '../../shared/enums.ts'

export type CharacterFilterCriteria = {
  search: string
  race: Race | null
  relation: Relation | null
  groupId: string | null
}

// Recherche (nom, gameId, rôle, note) + filtres combinables, tri alphabétique
// par nom (ou gameId à défaut) — cahier des charges §5.2, pas de tri au choix.
export function filterCharacters(
  characters: readonly Character[],
  criteria: CharacterFilterCriteria,
): Character[] {
  const searched = criteria.search.trim()

  const filtered = characters.filter((character) => {
    if (criteria.race !== null && character.race !== criteria.race) return false
    if (criteria.relation !== null && character.relation !== criteria.relation) return false
    if (criteria.groupId !== null && !character.groups.includes(criteria.groupId)) return false
    if (searched === '') return true

    const haystack = [character.name, character.gameId, character.role, character.note]
      .filter((value): value is string => value !== undefined)
      .join(' ')
    return match(haystack, searched)
  })

  return filtered.sort((a, b) =>
    (a.name ?? a.gameId ?? '').localeCompare(b.name ?? b.gameId ?? '', 'fr'),
  )
}
