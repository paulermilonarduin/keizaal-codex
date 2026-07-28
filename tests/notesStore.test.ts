import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.ts'
import * as notesRepo from '../server/repositories/notes.repo.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import { createHttpClient } from '../src/api/http.ts'
import { createApiClient } from '../src/api/endpoints.ts'
import { createNotesStore } from '../src/stores/notes.store.ts'
import { loadInitialData } from '../src/stores/bootstrap.ts'
import { createCharactersStore } from '../src/stores/characters.store.ts'
import { createGroupsStore } from '../src/stores/groups.store.ts'
import { createPoisStore } from '../src/stores/pois.store.ts'
import { createStoriesStore } from '../src/stores/stories.store.ts'

describe('createNotesStore', () => {
  test('part d’un texte vide', () => {
    const store = createNotesStore({} as never)
    assert.equal(store.text.value, '')
  })

  test('setInitial remplit sans déclencher d’enregistrement', () => {
    const store = createNotesStore({} as never)
    store.setInitial('depuis le serveur')

    assert.equal(store.text.value, 'depuis le serveur')
    // Régression visée : le watch d'App.vue ne doit pas prendre l'arrivée de la
    // valeur initiale pour une saisie, sinon chaque démarrage réécrit les notes.
    assert.equal(store.saving.value, false)
    assert.equal(store.dirty.value, false)
  })

  test('save envoie au serveur et retombe à l’état enregistré', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createNotesStore(api)

      store.text.value = 'écrit à la main'
      await store.save()

      assert.equal(notesRepo.read(db), 'écrit à la main')
      assert.equal(store.saving.value, false)
      assert.equal(store.dirty.value, false)
    })
  })

  test('save transmet la dernière valeur saisie', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createNotesStore(api)

      store.text.value = 'première'
      store.text.value = 'seconde'
      await store.save()

      assert.equal(notesRepo.read(db), 'seconde')
    })
  })

  test('markDirty signale une saisie en attente', () => {
    const store = createNotesStore({} as never)
    store.markDirty()
    assert.equal(store.dirty.value, true)
  })
})

describe('loadInitialData — notes', () => {
  test('peuple le store de notes depuis GET /api/data', async () => {
    const db = openDb(':memory:')
    notesRepo.write(db, 'notes existantes')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const stores = {
        characters: createCharactersStore(api),
        groups: createGroupsStore(api),
        pois: createPoisStore(api),
        notes: createNotesStore(api),
        stories: createStoriesStore(api),
      }

      await loadInitialData(api, stores)

      assert.equal(stores.notes.text.value, 'notes existantes')
      assert.equal(stores.notes.dirty.value, false)
    })
  })
})
