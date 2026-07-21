import type { Route } from '../lib/router.ts'
import type { PoisService } from '../services/pois.service.ts'

export function createPoisRoutes(pois: PoisService): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/pois',
      handler: ({ body }) => ({ status: 201, body: pois.create(body) }),
    },
    {
      method: 'PUT',
      path: '/api/pois/:id',
      handler: ({ params, body }) => ({ status: 200, body: pois.update(params.id ?? '', body) }),
    },
    {
      method: 'DELETE',
      path: '/api/pois/:id',
      handler: ({ params }) => {
        pois.remove(params.id ?? '')
        return { status: 204 }
      },
    },
  ]
}
