import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../server/db.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import { createGroupsService } from '../server/services/groups.service.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { NotFoundError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { Group } from '../shared/schemas.ts'

function makeServices() {
  const db = openDb(':memory:')
  return {
    db,
    groups: createGroupsService({ db, groupsRepo }),
    characters: createCharactersService({ db, charactersRepo }),
  }
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

describe('groups.service — CRUD', () => {
  test('crée un groupe avec UUID, list et get le retrouvent', () => {
    const { groups } = makeServices()
    const group = groups.create({ name: 'Compagnons', color: '#c0392b', description: 'Jorrvaskr' })
    assert.match(group.id, /^[0-9a-f-]{36}$/)
    assert.equal(group.color, '#c0392b')
    assert.equal(groups.get(group.id).name, 'Compagnons')
    assert.equal(groups.list().length, 1)
  })

  test('refuse un groupe sans nom ou avec une couleur invalide', () => {
    const { groups } = makeServices()
    assert.throws(() => groups.create({}))
    assert.throws(() => groups.create({ name: 'Compagnons', color: 'rouge' }))
  })

  test('met à jour nom, couleur et description', () => {
    const { groups } = makeServices()
    const group = groups.create({ name: 'Voleurs' })
    const updated = groups.update(group.id, { name: 'Guilde des voleurs', color: '#334455' })
    assert.equal(updated.name, 'Guilde des voleurs')
    assert.equal(updated.color, '#334455')
    assert.equal(updated.id, group.id)
  })

  test('get, update et remove sur un id inconnu → NotFoundError', () => {
    const { groups } = makeServices()
    assert.throws(() => groups.get(randomUUID()), NotFoundError)
    assert.throws(() => groups.update(randomUUID(), { name: 'X' }), NotFoundError)
    assert.throws(() => groups.remove(randomUUID()), NotFoundError)
  })

  test('supprimer un groupe retire ses liaisons mais PAS les personnages', () => {
    const { db, groups, characters } = makeServices()
    const group = groups.create({ name: 'Compagnons' })
    const character = characters.create({ name: 'Lydia', groups: [group.id] })

    groups.remove(group.id)

    assert.equal(countRows(db, 'groups'), 0)
    assert.equal(countRows(db, 'character_groups'), 0)
    assert.deepEqual(characters.get(character.id).groups, [])
    assert.equal(characters.get(character.id).name, 'Lydia')
  })
})

describe('API /api/groups — statuts HTTP', () => {
  test('POST → 201, invalide → 400, PUT → 200, DELETE → 204, inconnus → 404', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const created = await fetch(`${base}/api/groups`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Compagnons' }),
      })
      assert.equal(created.status, 201)
      const group = (await created.json()) as Group

      const invalid = await fetch(`${base}/api/groups`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color: '#c0392b' }),
      })
      assert.equal(invalid.status, 400)

      const put = await fetch(`${base}/api/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renommé' }),
      })
      assert.equal(put.status, 200)

      const putMissing = await fetch(`${base}/api/groups/${randomUUID()}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'X' }),
      })
      assert.equal(putMissing.status, 404)

      const del = await fetch(`${base}/api/groups/${group.id}`, { method: 'DELETE' })
      assert.equal(del.status, 204)

      const delMissing = await fetch(`${base}/api/groups/${group.id}`, { method: 'DELETE' })
      assert.equal(delMissing.status, 404)
    })
  })
})
