import type { ApiClient } from '../api/endpoints.ts'
import type { createCharactersStore } from './characters.store.ts'
import type { createGroupsStore } from './groups.store.ts'
import type { createPoisStore } from './pois.store.ts'

type Stores = {
  characters: ReturnType<typeof createCharactersStore>
  groups: ReturnType<typeof createGroupsStore>
  pois: ReturnType<typeof createPoisStore>
}

// Chargement initial : un seul GET /api/data, réparti dans les trois stores.
export async function loadInitialData(client: ApiClient, stores: Stores): Promise<void> {
  const data = await client.data.getAll()
  stores.characters.setAll(data.characters)
  stores.groups.setAll(data.groups)
  stores.pois.setAll(data.pois)
}
