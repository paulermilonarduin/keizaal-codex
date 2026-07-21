import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import { createHttpClient } from '../src/api/http.ts'
import { createApiClient } from '../src/api/endpoints.ts'
import { createCharactersStore } from '../src/stores/characters.store.ts'
import { createGroupsStore } from '../src/stores/groups.store.ts'
import { createPoisStore } from '../src/stores/pois.store.ts'
import { loadInitialData } from '../src/stores/bootstrap.ts'

describe('createCharactersStore — actions CRUD', () => {
  test('create ajoute au state, update et remove le maintiennent à jour', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createCharactersStore(api)

      const created = await store.create({ name: 'Lydia' })
      assert.equal(store.characters.value.length, 1)

      await store.update(created.id, { name: 'Lydia', relation: 'ami' })
      assert.equal(store.characters.value[0]?.relation, 'ami')

      await store.remove(created.id)
      assert.equal(store.characters.value.length, 0)
    })
  })
})

describe('loadInitialData', () => {
  test('peuple les trois stores depuis GET /api/data', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      // Peuplé via l'API pour simuler une base existante, pas via les stores.
      const group = await api.groups.create({ name: 'Compagnons' })
      await api.characters.create({ name: 'Lydia', groups: [group.id] })
      await api.pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })

      const characters = createCharactersStore(api)
      const groups = createGroupsStore(api)
      const pois = createPoisStore(api)
      assert.equal(characters.characters.value.length, 0)

      await loadInitialData(api, { characters, groups, pois })

      assert.equal(characters.characters.value.length, 1)
      assert.equal(groups.groups.value.length, 1)
      assert.equal(pois.pois.value.length, 1)
    })
  })
})
