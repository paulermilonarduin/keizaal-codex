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
import { createNotesStore } from '../src/stores/notes.store.ts'
import { createStoriesStore } from '../src/stores/stories.store.ts'
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

describe('createStoriesStore — actions CRUD (#83)', () => {
  test('create ajoute au state, update et remove le maintiennent à jour', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createStoriesStore(api)

      const created = await store.create({ title: 'Le siège' })
      assert.equal(store.stories.value.length, 1)

      await store.update(created.id, { title: 'Le siège de Blancherive', notes: 'Une nuit de feu.' })
      assert.equal(store.stories.value[0]?.title, 'Le siège de Blancherive')
      assert.equal(store.stories.value[0]?.notes, 'Une nuit de feu.')

      await store.remove(created.id)
      assert.equal(store.stories.value.length, 0)
    })
  })
})

describe('characters.pruneGroup : purge des ids morts (#100)', () => {
  test("retire l'id du groupe de toutes les fiches et laisse les autres ids intacts", async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createCharactersStore(api)

      const groupA = await api.groups.create({ name: 'Compagnons' })
      const groupB = await api.groups.create({ name: 'Confrérie' })
      const both = await store.create({ name: 'Lydia', groups: [groupA.id, groupB.id] })
      const onlyB = await store.create({ name: 'Astrid', groups: [groupB.id] })

      store.pruneGroup(groupA.id)

      const first = store.characters.value.find((c) => c.id === both.id)
      const second = store.characters.value.find((c) => c.id === onlyB.id)
      assert.deepEqual(first?.groups, [groupB.id])
      assert.deepEqual(second?.groups, [groupB.id])
    })
  })

  test('après purge, réenregistrer la fiche ne renvoie plus 400', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createCharactersStore(api)

      const group = await api.groups.create({ name: 'Compagnons' })
      const created = await store.create({ name: 'Lydia', groups: [group.id] })

      // Suppression par l'API, comme le ferait un autre handler : le serveur
      // cascade, le store garde l'id mort tant qu'on ne le purge pas.
      await api.groups.remove(group.id)
      store.pruneGroup(group.id)

      const fiche = store.characters.value.find((c) => c.id === created.id)
      assert.notEqual(fiche, undefined)
      const saved = await store.update(created.id, {
        name: fiche?.name ?? '',
        groups: [...(fiche?.groups ?? [])],
      })
      assert.deepEqual(saved.groups, [])
    })
  })
})

describe('stories : pruneCharacter / pruneGroup / prunePoi, purge des ids morts (#100)', () => {
  test("pruneCharacter retire l'id des histoires qui le référencent et pas des autres", async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createStoriesStore(api)

      const character = await api.characters.create({ name: 'Lydia' })
      const linked = await store.create({ title: 'Le siège', characters: [character.id] })
      const unlinked = await store.create({ title: 'La traversée' })

      store.pruneCharacter(character.id)

      const first = store.stories.value.find((s) => s.id === linked.id)
      const second = store.stories.value.find((s) => s.id === unlinked.id)
      assert.deepEqual(first?.characters, [])
      assert.deepEqual(second?.characters, [])
      assert.equal(second?.title, 'La traversée')
    })
  })

  test('pruneGroup et prunePoi purgent leurs listes sans toucher les autres liens', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createStoriesStore(api)

      const character = await api.characters.create({ name: 'Lydia' })
      const group = await api.groups.create({ name: 'Compagnons' })
      const poi = await api.pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
      const created = await store.create({
        title: 'Le siège',
        characters: [character.id],
        groups: [group.id],
        pois: [poi.id],
      })

      store.pruneGroup(group.id)
      store.prunePoi(poi.id)

      const story = store.stories.value.find((s) => s.id === created.id)
      assert.deepEqual(story?.groups, [])
      assert.deepEqual(story?.pois, [])
      assert.deepEqual(story?.characters, [character.id])
    })
  })

  test("après purge, réenregistrer l'histoire ne renvoie plus 400", async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const store = createStoriesStore(api)

      const character = await api.characters.create({ name: 'Lydia' })
      const created = await store.create({ title: 'Le siège', characters: [character.id] })

      await api.characters.remove(character.id)
      store.pruneCharacter(character.id)

      const story = store.stories.value.find((s) => s.id === created.id)
      assert.notEqual(story, undefined)
      const saved = await store.update(created.id, {
        title: 'Le siège de Blancherive',
        notes: story?.notes ?? '',
        characters: [...(story?.characters ?? [])],
        groups: [...(story?.groups ?? [])],
        pois: [...(story?.pois ?? [])],
      })
      assert.equal(saved.title, 'Le siège de Blancherive')
      assert.deepEqual(saved.characters, [])
    })
  })
})

describe('loadInitialData', () => {
  test('peuple les quatre stores depuis GET /api/data', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      // Peuplé via l'API pour simuler une base existante, pas via les stores.
      const group = await api.groups.create({ name: 'Compagnons' })
      await api.characters.create({ name: 'Lydia', groups: [group.id] })
      await api.pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
      await api.stories.create({ title: 'Le siège' })

      const characters = createCharactersStore(api)
      const groups = createGroupsStore(api)
      const pois = createPoisStore(api)
      const notes = createNotesStore(api)
      const stories = createStoriesStore(api)
      assert.equal(characters.characters.value.length, 0)

      await loadInitialData(api, { characters, groups, pois, notes, stories })

      assert.equal(characters.characters.value.length, 1)
      assert.equal(groups.groups.value.length, 1)
      assert.equal(pois.pois.value.length, 1)
      assert.equal(stories.stories.value.length, 1)
    })
  })
})
