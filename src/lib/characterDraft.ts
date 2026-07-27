import type { Character, CharacterInput, Position } from '../../shared/schemas.ts'

// Brouillon du formulaire personnage. Il transporte aussi l'image choisie
// (#74) : le mode placement démonte la modale (ARCHITECTURE.md §5.5), donc tout
// ce qui n'est pas ici est perdu au retour de la carte.
export type CharacterDraft = {
  name: string
  gameId: string
  race: CharacterInput['race']
  relation: CharacterInput['relation']
  role: string
  note: string
  groups: string[]
  position: CharacterInput['position']
  // Le blob et non l'objectURL : une URL révoquée serait inutilisable, et
  // transporter les deux inviterait à l'incohérence. La modale recrée l'URL.
  avatarBlob: Blob | null
}

export type PlacementRestore = {
  draft: unknown
  // Absent = retour d'une annulation ; présent = position posée sur la carte.
  update?: { position: Position }
}

export function draftFrom(character: Character | null): CharacterDraft {
  return {
    name: character?.name ?? '',
    gameId: character?.gameId ?? '',
    race: character?.race ?? 'Inconnue',
    relation: character?.relation ?? 'inconnu',
    role: character?.role ?? '',
    note: character?.note ?? '',
    // Copie : le formulaire coche et décoche les groupes en place, il ne doit
    // pas modifier le tableau du personnage du store.
    groups: [...(character?.groups ?? [])],
    position: character?.position,
    // L'avatar enregistré est un chemin de fichier, pas un blob : il continue
    // de s'afficher via le personnage.
    avatarBlob: null,
  }
}

// Brouillon avec lequel (re)monter la modale : celui du personnage, ou celui
// rapporté du mode placement, avec la position posée en plus le cas échéant.
export function restoredDraft(
  restore: PlacementRestore | null,
  character: Character | null,
): CharacterDraft {
  if (restore === null) return draftFrom(character)
  const base = restore.draft as CharacterDraft
  if (restore.update === undefined) return base
  return { ...base, position: restore.update.position }
}
