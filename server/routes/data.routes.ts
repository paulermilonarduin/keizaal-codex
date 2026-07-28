import type { Route } from '../lib/router.ts'
import type { CharactersService } from '../services/characters.service.ts'
import type { GroupsService } from '../services/groups.service.ts'
import type { PoisService } from '../services/pois.service.ts'
import type { NotesService } from '../services/notes.service.ts'
import type { StoriesService } from '../services/stories.service.ts'

export function createDataRoutes(
  characters: CharactersService,
  groups: GroupsService,
  pois: PoisService,
  notes: NotesService,
  stories: StoriesService,
): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/data',
      handler: () => ({
        status: 200,
        body: {
          characters: characters.list(),
          groups: groups.list(),
          pois: pois.list(),
          // Livrées avec l'état initial : pas de second aller-retour au
          // démarrage juste pour un champ texte (#72).
          notes: notes.get(),
          stories: stories.list(),
        },
      }),
    },
  ]
}
