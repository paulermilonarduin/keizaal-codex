import type { DatabaseSync } from 'node:sqlite'
import { notesInputSchema } from '../../shared/schemas.ts'

type NotesRepo = typeof import('../repositories/notes.repo.ts')
type Deps = { db: DatabaseSync; notesRepo: NotesRepo }

export function createNotesService({ db, notesRepo }: Deps) {
  return {
    get(): string {
      return notesRepo.read(db)
    },

    // Pas de trim : ce sont des notes libres, l'utilisateur décide de sa mise
    // en forme. Le serveur reste l'autorité sur la borne haute.
    save(input: unknown): string {
      const { text } = notesInputSchema.parse(input)
      notesRepo.write(db, text)
      return notesRepo.read(db)
    },
  }
}

export type NotesService = ReturnType<typeof createNotesService>
