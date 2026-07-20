import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { characterInputSchema, type Character } from '../../shared/schemas.ts'
import { transaction } from '../db.ts'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.ts'

type CharactersRepo = typeof import('../repositories/characters.repo.ts')
type Deps = { db: DatabaseSync; charactersRepo: CharactersRepo }

export function createCharactersService({ db, charactersRepo }: Deps) {
  function requireCharacter(id: string): Character {
    const character = charactersRepo.findById(db, id)
    if (character === undefined) throw new NotFoundError('Fiche personnage introuvable')
    return character
  }

  // Écritures fiche + liaisons groupes dans une transaction unique ; les
  // contraintes SQL (UNIQUE gameId, FK groupes) sont l'autorité, traduites
  // ensuite en erreurs métier.
  function writeWithGroups(
    character: Character,
    groups: readonly string[],
    write: () => void,
  ): Character {
    try {
      return transaction(db, () => {
        write()
        charactersRepo.setGroups(db, character.id, groups)
        return requireCharacter(character.id)
      })
    } catch (error) {
      throw translateConstraintError(error)
    }
  }

  return {
    list(): Character[] {
      return charactersRepo.findAll(db)
    },

    get(id: string): Character {
      return requireCharacter(id)
    },

    create(input: unknown): Character {
      const data = characterInputSchema.parse(input)
      const now = new Date().toISOString()
      const character: Character = { ...data, id: randomUUID(), createdAt: now, updatedAt: now }
      return writeWithGroups(character, data.groups, () => charactersRepo.insert(db, character))
    },

    update(id: string, input: unknown): Character {
      const existing = requireCharacter(id)
      const data = characterInputSchema.parse(input)
      const character: Character = {
        ...data,
        id,
        avatar: existing.avatar,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      }
      return writeWithGroups(character, data.groups, () => charactersRepo.update(db, character))
    },

    remove(id: string): void {
      requireCharacter(id)
      charactersRepo.remove(db, id)
    },
  }
}

export type CharactersService = ReturnType<typeof createCharactersService>

function translateConstraintError(error: unknown): unknown {
  if (error instanceof Error) {
    if (error.message.includes('UNIQUE constraint failed: characters.game_id')) {
      return new ConflictError('Ce gameId est déjà utilisé par une autre fiche')
    }
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return new ValidationError('Un des groupes sélectionnés n’existe pas', 'groups')
    }
  }
  return error
}
