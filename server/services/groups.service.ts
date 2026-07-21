import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { groupInputSchema, type Group } from '../../shared/schemas.ts'
import { requireFound } from '../lib/require.ts'

type GroupsRepo = typeof import('../repositories/groups.repo.ts')
type Deps = { db: DatabaseSync; groupsRepo: GroupsRepo }

export function createGroupsService({ db, groupsRepo }: Deps) {
  function requireGroup(id: string): Group {
    return requireFound(groupsRepo.findById(db, id), 'Groupe introuvable')
  }

  return {
    list(): Group[] {
      return groupsRepo.findAll(db)
    },

    get(id: string): Group {
      return requireGroup(id)
    },

    create(input: unknown): Group {
      const data = groupInputSchema.parse(input)
      const group: Group = { ...data, id: randomUUID() }
      groupsRepo.insert(db, group)
      return requireGroup(group.id)
    },

    update(id: string, input: unknown): Group {
      requireGroup(id)
      const data = groupInputSchema.parse(input)
      groupsRepo.update(db, { ...data, id })
      return requireGroup(id)
    },

    // La cascade FK retire les liaisons character_groups, jamais les personnages.
    remove(id: string): void {
      requireGroup(id)
      groupsRepo.remove(db, id)
    },
  }
}

export type GroupsService = ReturnType<typeof createGroupsService>
