import { match } from './text.ts'
import type { Group } from '../../shared/schemas.ts'

// Miroir de filterCharacters : recherche insensible casse/accents puis tri
// alphabétique français. La description entre dans la recherche même si elle
// n'est éditable nulle part pour l'instant — l'import JSON peut en contenir.
export function filterGroups(groups: readonly Group[], search: string): Group[] {
  const searched = search.trim()

  const filtered = groups.filter((group) => {
    if (searched === '') return true

    const haystack = [group.name, group.description]
      .filter((value): value is string => value !== undefined)
      .join(' ')
    return match(haystack, searched)
  })

  // filter() a déjà produit un nouveau tableau : le tri en place ne touche pas
  // celui du store.
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
