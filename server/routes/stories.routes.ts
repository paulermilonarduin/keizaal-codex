import type { Route } from '../lib/router.ts'
import type { StoriesService } from '../services/stories.service.ts'

// Pas de GET de liste : les histoires arrivent avec l'état initial de
// /api/data, comme les personnages, groupes et POI.
export function createStoriesRoutes(stories: StoriesService): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/stories',
      handler: ({ body }) => ({ status: 201, body: stories.create(body) }),
    },
    {
      method: 'PUT',
      path: '/api/stories/:id',
      handler: ({ params, body }) => ({ status: 200, body: stories.update(params.id ?? '', body) }),
    },
    {
      method: 'DELETE',
      path: '/api/stories/:id',
      handler: ({ params }) => {
        stories.remove(params.id ?? '')
        return { status: 204 }
      },
    },
  ]
}
