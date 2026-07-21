import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { poiInputSchema, type Poi } from '../../shared/schemas.ts'
import { NotFoundError } from '../lib/errors.ts'

type PoisRepo = typeof import('../repositories/pois.repo.ts')
type Deps = { db: DatabaseSync; poisRepo: PoisRepo }

export function createPoisService({ db, poisRepo }: Deps) {
  function requirePoi(id: string): Poi {
    const poi = poisRepo.findById(db, id)
    if (poi === undefined) throw new NotFoundError('Point d’intérêt introuvable')
    return poi
  }

  return {
    list(): Poi[] {
      return poisRepo.findAll(db)
    },

    get(id: string): Poi {
      return requirePoi(id)
    },

    create(input: unknown): Poi {
      const data = poiInputSchema.parse(input)
      const poi: Poi = { ...data, id: randomUUID() }
      poisRepo.insert(db, poi)
      return requirePoi(poi.id)
    },

    update(id: string, input: unknown): Poi {
      requirePoi(id)
      const data = poiInputSchema.parse(input)
      poisRepo.update(db, { ...data, id })
      return requirePoi(id)
    },

    remove(id: string): void {
      requirePoi(id)
      poisRepo.remove(db, id)
    },
  }
}

export type PoisService = ReturnType<typeof createPoisService>
