import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { uuid } from '../../shared/schemas.ts'
import type { Character } from '../../shared/schemas.ts'
import { ValidationError } from '../lib/errors.ts'
import { requireFound } from '../lib/require.ts'

type CharactersRepo = typeof import('../repositories/characters.repo.ts')
type Deps = { db: DatabaseSync; charactersRepo: CharactersRepo; avatarsDir?: string }

export function createAvatarsService({ db, charactersRepo, avatarsDir = 'data/avatars' }: Deps) {
  // Validation UUID stricte AVANT tout accès disque ou base : un id malformé
  // ne peut alors jamais désigner un chemin hors de avatarsDir.
  function requireValidId(id: string): string {
    const result = uuid.safeParse(id)
    if (!result.success) throw new ValidationError('Identifiant invalide', 'id')
    return result.data
  }

  function requireCharacter(id: string): Character {
    return requireFound(charactersRepo.findById(db, id), 'Fiche personnage introuvable')
  }

  return {
    async upload(id: string, bytes: Buffer): Promise<Character> {
      const validId = requireValidId(id)
      requireCharacter(validId)
      await mkdir(avatarsDir, { recursive: true })
      await writeFile(join(avatarsDir, `${validId}.webp`), bytes)
      charactersRepo.updateAvatar(db, validId, `avatars/${validId}.webp`)
      return requireCharacter(validId)
    },

    async remove(id: string): Promise<void> {
      const validId = requireValidId(id)
      requireCharacter(validId)
      await unlink(join(avatarsDir, `${validId}.webp`)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      charactersRepo.updateAvatar(db, validId, null)
    },
  }
}

export type AvatarsService = ReturnType<typeof createAvatarsService>
