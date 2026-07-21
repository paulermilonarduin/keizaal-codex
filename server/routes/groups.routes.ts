import type { Route } from '../lib/router.ts'
import type { GroupsService } from '../services/groups.service.ts'

export function createGroupsRoutes(groups: GroupsService): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/groups',
      handler: ({ body }) => ({ status: 201, body: groups.create(body) }),
    },
    {
      method: 'PUT',
      path: '/api/groups/:id',
      handler: ({ params, body }) => ({ status: 200, body: groups.update(params.id ?? '', body) }),
    },
    {
      method: 'DELETE',
      path: '/api/groups/:id',
      handler: ({ params }) => {
        groups.remove(params.id ?? '')
        return { status: 204 }
      },
    },
  ]
}
