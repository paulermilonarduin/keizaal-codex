import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import { createHttpClient, HttpError } from '../src/api/http.ts'
import { createApiClient } from '../src/api/endpoints.ts'

describe('createHttpClient', () => {
  test('GET renvoie le JSON parsé', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const http = createHttpClient(`${base}/api`)
      const health = await http.get<{ status: string }>('/health')
      assert.deepEqual(health, { status: 'ok' })
    })
  })

  test('POST envoie le body en JSON et renvoie la réponse', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const http = createHttpClient(`${base}/api`)
      const group = await http.post<{ id: string; name: string }>('/groups', { name: 'Compagnons' })
      assert.equal(group.name, 'Compagnons')
    })
  })

  test('une erreur HTTP est normalisée en HttpError avec code/message/field', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const http = createHttpClient(`${base}/api`)
      await assert.rejects(
        () => http.post('/characters', { race: 'Nordique' }),
        (error: unknown) => {
          assert.ok(error instanceof HttpError)
          assert.equal(error.status, 400)
          assert.equal(error.code, 'VALIDATION')
          assert.equal(error.field, 'name')
          return true
        },
      )
    })
  })

  test('DELETE (204 sans corps) ne lève pas', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const http = createHttpClient(`${base}/api`)
      const character = await http.post<{ id: string }>('/characters', { name: 'Lydia' })
      await assert.doesNotReject(() => http.delete(`/characters/${character.id}`))
    })
  })
})

describe('createApiClient', () => {
  test('data.getAll agrège characters + groups + pois', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      await api.groups.create({ name: 'Compagnons' })
      await api.characters.create({ name: 'Lydia' })
      await api.pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })

      const data = await api.data.getAll()
      assert.equal(data.characters.length, 1)
      assert.equal(data.groups.length, 1)
      assert.equal(data.pois.length, 1)
    })
  })

  test('characters.update modifie la fiche', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const api = createApiClient(createHttpClient(`${base}/api`))
      const created = await api.characters.create({ name: 'Lydia' })
      const updated = await api.characters.update(created.id, { name: 'Lydia', relation: 'ami' })
      assert.equal(updated.relation, 'ami')
    })
  })
})
