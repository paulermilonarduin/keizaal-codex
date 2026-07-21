import type { Route } from '../lib/router.ts'
import type { AvatarsService } from '../services/avatars.service.ts'

export function createAvatarsRoutes(avatars: AvatarsService): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/avatars/:id',
      raw: true,
      handler: async ({ params, body }) => ({
        status: 200,
        body: await avatars.upload(params.id ?? '', body as Buffer),
      }),
    },
    {
      method: 'DELETE',
      path: '/api/avatars/:id',
      handler: async ({ params }) => {
        await avatars.remove(params.id ?? '')
        return { status: 204 }
      },
    },
  ]
}
