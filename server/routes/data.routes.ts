import type { Route } from '../lib/router.ts'
import type { CharactersService } from '../services/characters.service.ts'
import type { GroupsService } from '../services/groups.service.ts'
import type { PoisService } from '../services/pois.service.ts'

export function createDataRoutes(
  characters: CharactersService,
  groups: GroupsService,
  pois: PoisService,
): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/data',
      handler: () => ({
        status: 200,
        body: { characters: characters.list(), groups: groups.list(), pois: pois.list() },
      }),
    },
  ]
}
