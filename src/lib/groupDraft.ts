import type { Group, GroupInput } from '../../shared/schemas.ts'

// Couleur de repli : un <input type="color"> exige toujours une valeur, alors
// qu'un groupe peut n'en avoir aucune. Blanc neutre plutôt que l'accent doré de
// GroupCreateRow : contrairement à la description, cette couleur est renvoyée
// telle quelle par buildInput même sans modification (#113).
const DEFAULT_COLOR = '#ffffff'

// Brouillon du formulaire groupe (#113). `description` y est une chaîne et non
// `string | undefined` : le champ est un <input type="text">, et '' y signifie
// « pas de description ».
export type GroupDraft = {
  name: string
  color: string
  description: string
  notes: string
}

export function draftFrom(group: Group | null): GroupDraft {
  return {
    name: group?.name ?? '',
    color: group?.color ?? DEFAULT_COLOR,
    description: group?.description ?? '',
    notes: group?.notes ?? '',
  }
}

export function buildInput(draft: GroupDraft): GroupInput {
  const description = draft.description.trim()

  return {
    name: draft.name.trim(),
    color: draft.color,
    // Même règle que groupInputFrom : le schéma déclare la description
    // optionnelle, `''` serait un état parasite.
    description: description === '' ? undefined : description,
    // Notes reprises telles quelles, espaces compris : c'est un texte libre.
    notes: draft.notes,
  }
}
