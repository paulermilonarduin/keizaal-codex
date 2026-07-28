import type { Character, CharacterInput, Position } from '../../shared/schemas.ts'

// `characters.update` est un PUT : il remplace toute la fiche. Déplacer un pin
// sur la carte (#88) doit donc reconstruire l'entrée complète depuis la fiche
// existante en ne changeant que la position, sinon le glisser-déposer écraserait
// les groupes, la note ou le rôle. Ni `id`, ni `avatar` (upload séparé, préservé
// par le serveur), ni les timestamps ne font partie de l'entrée.
export function movedCharacterInput(character: Character, position: Position): CharacterInput {
  return {
    gameId: character.gameId,
    name: character.name,
    race: character.race,
    relation: character.relation,
    role: character.role,
    note: character.note,
    // Copie : l'entrée ne doit pas partager le tableau du personnage du store.
    groups: [...character.groups],
    position,
  }
}
