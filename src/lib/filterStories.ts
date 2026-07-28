import { match } from './text.ts'
import type { Story } from '../../shared/schemas.ts'

// Miroir de filterGroups : recherche insensible casse/accents sur le titre et
// les notes, puis tri alphabétique français. Les notes entrent dans la
// recherche parce que c'est là que vivent les détails d'une histoire (#83).
export function filterStories(stories: readonly Story[], search: string): Story[] {
  const searched = search.trim()

  const filtered = stories.filter((story) => {
    if (searched === '') return true
    return match([story.title, story.notes].join(' '), searched)
  })

  // filter() a déjà produit un nouveau tableau : le tri en place ne touche pas
  // celui du store.
  return filtered.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}
