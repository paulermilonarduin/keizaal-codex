import type { ApiClient } from '../api/endpoints.ts'
import type { createCharactersStore } from './characters.store.ts'
import type { createGroupsStore } from './groups.store.ts'
import type { createPoisStore } from './pois.store.ts'
import type { createNotesStore } from './notes.store.ts'
import type { createStoriesStore } from './stories.store.ts'

// Réduit au strict contrat utilisé ci-dessous : les stores Pinia déballent
// l'état (Ref<T> -> T) mais pas les méthodes, donc exiger le type complet des
// factories rendrait les vrais stores non assignables (cf. #95).
type Stores = {
  characters: Pick<ReturnType<typeof createCharactersStore>, 'setAll'>
  groups: Pick<ReturnType<typeof createGroupsStore>, 'setAll'>
  pois: Pick<ReturnType<typeof createPoisStore>, 'setAll'>
  notes: Pick<ReturnType<typeof createNotesStore>, 'setInitial'>
  stories: Pick<ReturnType<typeof createStoriesStore>, 'setAll'>
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
