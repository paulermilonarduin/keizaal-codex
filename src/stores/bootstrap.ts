import type { ApiClient } from '../api/endpoints.ts'
import type { createCharactersStore } from './characters.store.ts'
import type { createGroupsStore } from './groups.store.ts'
import type { createPoisStore } from './pois.store.ts'
import type { createNotesStore } from './notes.store.ts'

type Stores = {
  characters: ReturnType<typeof createCharactersStore>
  groups: ReturnType<typeof createGroupsStore>
  pois: ReturnType<typeof createPoisStore>
  notes: ReturnType<typeof createNotesStore>
}

// Chargement initial : un seul GET /api/data, réparti dans les stores.
export async function loadInitialData(client: ApiClient, stores: Stores): Promise<void> {
  const data = await client.data.getAll()
  stores.characters.setAll(data.characters)
  stores.groups.setAll(data.groups)
  stores.pois.setAll(data.pois)
  // setInitial et non une affectation directe : sans ça le watch du panneau
  // prendrait ce chargement pour une saisie et réécrirait les notes (#72).
  stores.notes.setInitial(data.notes)
}
