import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { openDb } from '../server/db.ts'
import * as poisRepo from '../server/repositories/pois.repo.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import { createPoisService } from '../server/services/pois.service.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { createGroupsService } from '../server/services/groups.service.ts'
import { NotFoundError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { Poi } from '../shared/schemas.ts'

function makeServices() {
  const db = openDb(':memory:')
  return { db, pois: createPoisService({ db, poisRepo }) }
}

describe('pois.service — CRUD', () => {
  test('crée un POI avec UUID et type par défaut « autre »', () => {
    const { pois } = makeServices()
    const poi = pois.create({ name: 'Blancherive', x: 2450, y: 3100 })
    assert.match(poi.id, /^[0-9a-f-]{36}$/)
    assert.equal(poi.type, 'autre')
  })

  test('accepte un type de la liste fermée', () => {
    const { pois } = makeServices()
    const poi = pois.create({ name: 'Blancherive', type: 'capitale', x: 2450, y: 3100 })
    assert.equal(poi.type, 'capitale')
  })

  test('refuse un POI sans coordonnées ou avec un type hors liste', () => {
    const { pois } = makeServices()
    assert.throws(() => pois.create({ name: 'Blancherive' }))
    assert.throws(() => pois.create({ name: 'Blancherive', type: 'donjon', x: 1, y: 2 }))
  })

  test('list et get retrouvent les POI créés', () => {
    const { pois } = makeServices()
    const poi = pois.create({ name: 'Blancherive', x: 2450, y: 3100 })
    pois.create({ name: 'Rivebois', type: 'village', x: 2600, y: 3600 })
    assert.equal(pois.get(poi.id).name, 'Blancherive')
    assert.equal(pois.list().length, 2)
  })

  test('met à jour nom, type et coordonnées (déplacement)', () => {
    const { pois } = makeServices()
    const poi = pois.create({ name: 'Blancherive', x: 2450, y: 3100 })
    const updated = pois.update(poi.id, { name: 'Blancherive', type: 'capitale', x: 2460, y: 3110 })
    assert.equal(updated.type, 'capitale')
    assert.equal(updated.x, 2460)
    assert.equal(updated.id, poi.id)
  })

  test('supprime un POI', () => {
    const { pois } = makeServices()
    const poi = pois.create({ name: 'Blancherive', x: 2450, y: 3100 })
    pois.remove(poi.id)
    assert.equal(pois.list().length, 0)
  })

  test('get, update et remove sur un id inconnu → NotFoundError', () => {
    const { pois } = makeServices()
    assert.throws(() => pois.get(randomUUID()), NotFoundError)
    assert.throws(() => pois.update(randomUUID(), { name: 'X', x: 1, y: 2 }), NotFoundError)
    assert.throws(() => pois.remove(randomUUID()), NotFoundError)
  })
})

describe('API /api/pois — statuts HTTP', () => {
  test('POST → 201, invalide → 400, PUT → 200, DELETE → 204, inconnus → 404', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const created = await fetch(`${base}/api/pois`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Blancherive', x: 2450, y: 3100 }),
      })
      assert.equal(created.status, 201)
      const poi = (await created.json()) as Poi

      const invalid = await fetch(`${base}/api/pois`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Sans coordonnées' }),
      })
      assert.equal(invalid.status, 400)

      const put = await fetch(`${base}/api/pois/${poi.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Blancherive', x: 2500, y: 3150 }),
      })
      assert.equal(put.status, 200)

      const putMissing = await fetch(`${base}/api/pois/${randomUUID()}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'X', x: 1, y: 2 }),
      })
      assert.equal(putMissing.status, 404)

      const del = await fetch(`${base}/api/pois/${poi.id}`, { method: 'DELETE' })
      assert.equal(del.status, 204)

      const delMissing = await fetch(`${base}/api/pois/${poi.id}`, { method: 'DELETE' })
      assert.equal(delMissing.status, 404)
    })
  })
})

describe('API /api/data', () => {
  test('renvoie characters + groups + pois', async () => {
    const db = openDb(':memory:')
    const charactersService = createCharactersService({ db, charactersRepo })
    const groupsService = createGroupsService({ db, groupsRepo })
    const poisService = createPoisService({ db, poisRepo })

    const group = groupsService.create({ name: 'Compagnons' })
    charactersService.create({ name: 'Lydia', groups: [group.id] })
    poisService.create({ name: 'Blancherive', x: 2450, y: 3100 })

    await withServer(createApp(db), async (base) => {
      const res = await fetch(`${base}/api/data`)
      assert.equal(res.status, 200)
      const body = (await res.json()) as { characters: unknown[]; groups: unknown[]; pois: unknown[] }
      assert.equal(body.characters.length, 1)
      assert.equal(body.groups.length, 1)
      assert.equal(body.pois.length, 1)
    })
  })

  test('renvoie des tableaux vides sur une base neuve', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const res = await fetch(`${base}/api/data`)
      const body = (await res.json()) as { characters: unknown[]; groups: unknown[]; pois: unknown[] }
      assert.deepEqual(body, { characters: [], groups: [], pois: [] })
    })
  })
})
