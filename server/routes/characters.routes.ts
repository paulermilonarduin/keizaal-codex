import type { Route } from '../lib/router.ts'
import type { CharactersService } from '../services/characters.service.ts'

export function createCharactersRoutes(characters: CharactersService): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/characters',
      handler: ({ body }) => ({ status: 201, body: characters.create(body) }),
    },
    {
      method: 'PUT',
      path: '/api/characters/:id',
      handler: ({ params, body }) => ({
        status: 200,
        body: characters.update(params.id ?? '', body),
      }),
    },
    {
      method: 'DELETE',
      path: '/api/characters/:id',
      handler: ({ params }) => {
        characters.remove(params.id ?? '')
        return { status: 204 }
      },
    },
  ]
}
