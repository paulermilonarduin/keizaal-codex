import type { Group, GroupInput } from '../../shared/schemas.ts'

// L'API remplace le groupe entier (PUT) : un champ absent du corps est effacé.
// Passer par cette fonction plutôt que de construire l'objet à la main garantit
// qu'éditer un champ ne perd pas les autres — c'est ainsi que la description,
// éditable depuis #63, survit à un simple renommage.
export function groupInputFrom(group: Group, changes: Partial<GroupInput>): GroupInput {
  const description = changes.description ?? group.description
  const trimmed = description?.trim()

  return {
    name: changes.name ?? group.name,
    color: changes.color ?? group.color,
    // Une description vidée doit disparaître, pas être stockée comme chaîne
    // vide : le schéma la déclare optionnelle, `''` serait un état parasite.
    description: trimmed === '' ? undefined : trimmed,
  }
}
