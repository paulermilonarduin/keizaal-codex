import type { Story, StoryInput } from '../../shared/schemas.ts'

// Brouillon du formulaire histoire. `date` y est une chaîne et non
// `string | undefined` : le champ est un <input type="date">, qui ne manipule
// que des chaînes, et '' y signifie « pas de date ».
export type StoryDraft = {
  title: string
  date: string
  notes: string
  characters: string[]
  groups: string[]
  pois: string[]
}

export function draftFrom(story: Story | null): StoryDraft {
  return {
    title: story?.title ?? '',
    date: story?.date ?? '',
    notes: story?.notes ?? '',
    // Copies : le formulaire ajoute et retire des liens en place, il ne doit
    // pas modifier les tableaux de l'histoire du store.
    characters: [...(story?.characters ?? [])],
    groups: [...(story?.groups ?? [])],
    pois: [...(story?.pois ?? [])],
  }
}

export function buildInput(draft: StoryDraft): StoryInput {
  return {
    title: draft.title.trim(),
    date: draft.date === '' ? undefined : draft.date,
    notes: draft.notes,
    characters: draft.characters,
    groups: draft.groups,
    pois: draft.pois,
  }
}
