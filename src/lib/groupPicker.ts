import type { Group } from '../../shared/schemas.ts'

// Sélection des groupes d'un personnage depuis la modale de choix (#114). La
// sélection vit dans le brouillon de la fiche : ces fonctions rendent toujours
// un nouveau tableau, le picker ne mute jamais la prop qu'il reçoit.
export function toggledIds(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((current) => current !== id)
  return [...ids, id]
}

// Premier id de `groups` absent de `knownIds`, ou null. Sert à repérer le groupe
// tout juste créé depuis le picker pour le cocher automatiquement : le store
// remonte la liste complète, pas l'id créé.
export function appearedGroupId(
  knownIds: readonly string[],
  groups: readonly Group[],
): string | null {
  return groups.find((group) => !knownIds.includes(group.id))?.id ?? null
}
