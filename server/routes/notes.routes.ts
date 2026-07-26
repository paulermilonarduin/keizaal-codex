import type { Route } from '../lib/router.ts'
import type { NotesService } from '../services/notes.service.ts'

export function createNotesRoutes(notes: NotesService): Route[] {
  return [
    {
      // PUT et non PATCH : il n'y a qu'un seul champ, l'écriture remplace tout.
      // La lecture passe par GET /api/data avec le reste de l'état initial.
      method: 'PUT',
      path: '/api/notes',
      handler: ({ body }) => ({ status: 200, body: { text: notes.save(body) } }),
    },
  ]
}
