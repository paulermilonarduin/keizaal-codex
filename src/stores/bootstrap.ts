import type { ApiClient } from '../api/endpoints.ts'
import type { createCharactersStore } from './characters.store.ts'
import type { createGroupsStore } from './groups.store.ts'
import type { createPoisStore } from './pois.store.ts'
import type { createNotesStore } from './notes.store.ts'
import type { createStoriesStore } from './stories.store.ts'

type Stores = {
  characters: ReturnType<typeof createCharactersStore>
  groups: ReturnType<typeof createGroupsStore>
  pois: ReturnType<typeof createPoisStore>
  notes: ReturnType<typeof createNotesStore>
  stories: ReturnType<typeof createStoriesStore>
}

// Chargement initial : un seul GET /api/data, réparti dans les stores.
export async function loadInitialData(client: ApiClient, stores: Stores): Promise<void> {
  const data = await client.data.getAll()
  stores.characters.setAll(data.characters)
  stores.groups.setAll(data.groups)
  stores.pois.setAll(data.pois)
  stores.stories.setAll(data.stories)
  // setInitial et non une affectation directe : sans ça le watch du panneau
  // prendrait ce chargement pour une saisie et réécrirait les notes (#72).
  stores.notes.setInitial(data.notes)
}
