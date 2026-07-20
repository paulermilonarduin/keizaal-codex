import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../server/db.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { ConflictError, NotFoundError, ValidationError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { Character } from '../shared/schemas.ts'

function makeService() {
  const db = openDb(':memory:')
  const service = createCharactersService({ db, charactersRepo })
  return { db, service }
}

function insertGroup(db: DatabaseSync, name = 'Compagnons'): string {
  const id = randomUUID()
  db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(id, name)
  return id
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

describe('characters.service — création', () => {
  test('crée une fiche minimale avec défauts, UUID et timestamps', () => {
    const { service } = makeService()
    const character = service.create({ name: 'Lydia' })
    assert.match(character.id, /^[0-9a-f-]{36}$/)
    assert.equal(character.name, 'Lydia')
    assert.equal(character.race, 'Inconnue')
    assert.equal(character.relation, 'inconnu')
    assert.deepEqual(character.groups, [])
    assert.equal(character.createdAt, character.updatedAt)
  })

  test('persiste les deux positions, avec date sur la position connue', () => {
    const { service } = makeService()
    const character = service.create({
      gameId: '#48213',
      name: 'Compte-les-Sous',
      race: 'Argonien',
      relation: 'ami',
      role: 'Aubergiste',
      homePosition: { x: 2450, y: 3120, label: 'Blancherive' },
      knownPosition: { x: 1100, y: 900, label: 'Solitude', date: '2026-07-15' },
    })
    assert.deepEqual(character.homePosition, { x: 2450, y: 3120, label: 'Blancherive' })
    assert.deepEqual(character.knownPosition, {
      x: 1100,
      y: 900,
      label: 'Solitude',
      date: '2026-07-15',
    })
  })

  test('lie les groupes dans la même transaction', () => {
    const { db, service } = makeService()
    const groupId = insertGroup(db)
    const character = service.create({ name: 'Lydia', groups: [groupId] })
    assert.deepEqual(character.groups, [groupId])
    assert.equal(countRows(db, 'character_groups'), 1)
  })

  test('groupe inconnu → ValidationError et AUCUNE fiche créée (atomicité)', () => {
    const { db, service } = makeService()
    const groupId = insertGroup(db)
    assert.throws(
      () => service.create({ name: 'Lydia', groups: [groupId, randomUUID()] }),
      ValidationError,
    )
    assert.equal(countRows(db, 'characters'), 0)
    assert.equal(countRows(db, 'character_groups'), 0)
  })

  test('gameId déjà pris → ConflictError', () => {
    const { service } = makeService()
    service.create({ gameId: '#48213' })
    assert.throws(() => service.create({ gameId: '#48213', name: 'Autre' }), ConflictError)
  })

  test('entrée sans identité minimale → erreur de validation', () => {
    const { service } = makeService()
    assert.throws(() => service.create({ race: 'Nordique' }))
  })
})

describe('characters.service — lecture', () => {
  test('get retourne la fiche, list retourne tout', () => {
    const { service } = makeService()
    const a = service.create({ name: 'Lydia' })
    service.create({ name: 'Balgruuf' })
    assert.equal(service.get(a.id).name, 'Lydia')
    assert.equal(service.list().length, 2)
  })

  test('get sur un id inconnu → NotFoundError', () => {
    const { service } = makeService()
    assert.throws(() => service.get(randomUUID()), NotFoundError)
  })
})

describe('characters.service — mise à jour', () => {
  test('remplace les champs, préserve createdAt, régénère updatedAt', () => {
    const { service } = makeService()
    const created = service.create({ name: 'Lydia', role: 'Huscarl' })
    const updated = service.update(created.id, { name: 'Lydia', relation: 'ami' })
    assert.equal(updated.relation, 'ami')
    assert.equal(updated.role, undefined)
    assert.equal(updated.createdAt, created.createdAt)
    assert.ok(updated.updatedAt >= created.updatedAt)
  })

  test('remplace la liste des groupes (les anciennes liaisons partent)', () => {
    const { db, service } = makeService()
    const g1 = insertGroup(db, 'Compagnons')
    const g2 = insertGroup(db, 'Voleurs')
    const created = service.create({ name: 'Lydia', groups: [g1] })
    const updated = service.update(created.id, { name: 'Lydia', groups: [g2] })
    assert.deepEqual(updated.groups, [g2])
    assert.equal(countRows(db, 'character_groups'), 1)
  })

  test('peut supprimer une position (absente de la mise à jour)', () => {
    const { service } = makeService()
    const created = service.create({
      name: 'Lydia',
      knownPosition: { x: 1, y: 2, date: '2026-07-15' },
    })
    const updated = service.update(created.id, { name: 'Lydia' })
    assert.equal(updated.knownPosition, undefined)
  })

  test('gameId pris par une autre fiche → ConflictError, garder le sien est OK', () => {
    const { service } = makeService()
    service.create({ gameId: '#111' })
    const mine = service.create({ gameId: '#222' })
    assert.throws(() => service.update(mine.id, { gameId: '#111' }), ConflictError)
    assert.equal(service.update(mine.id, { gameId: '#222', name: 'Moi' }).gameId, '#222')
  })

  test('groupe inconnu → rollback complet de la mise à jour (atomicité)', () => {
    const { db, service } = makeService()
    const created = service.create({ name: 'Lydia' })
    assert.throws(
      () => service.update(created.id, { name: 'Renommée', groups: [randomUUID()] }),
      ValidationError,
    )
    assert.equal(service.get(created.id).name, 'Lydia')
    assert.equal(countRows(db, 'character_groups'), 0)
  })

  test('id inconnu → NotFoundError', () => {
    const { service } = makeService()
    assert.throws(() => service.update(randomUUID(), { name: 'X' }), NotFoundError)
  })
})

describe('characters.service — suppression', () => {
  test('supprime la fiche et ses liaisons', () => {
    const { db, service } = makeService()
    const groupId = insertGroup(db)
    const created = service.create({ name: 'Lydia', groups: [groupId] })
    service.remove(created.id)
    assert.equal(countRows(db, 'characters'), 0)
    assert.equal(countRows(db, 'character_groups'), 0)
    assert.equal(countRows(db, 'groups'), 1)
  })

  test('id inconnu → NotFoundError', () => {
    const { service } = makeService()
    assert.throws(() => service.remove(randomUUID()), NotFoundError)
  })
})

describe('API /api/characters — statuts HTTP', () => {
  test('POST → 201, conflit gameId → 409, invalide → 400', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const post = (body: unknown) =>
        fetch(`${base}/api/characters`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })

      const created = await post({ gameId: '#48213', name: 'Compte-les-Sous' })
      assert.equal(created.status, 201)
      const character = (await created.json()) as Character
      assert.equal(character.name, 'Compte-les-Sous')

      const conflict = await post({ gameId: '#48213' })
      assert.equal(conflict.status, 409)

      const invalid = await post({ race: 'Nordique' })
      assert.equal(invalid.status, 400)
    })
  })

  test('PUT → 200 sur une fiche existante, 404 sinon', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const created = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      const character = (await created.json()) as Character

      const put = await fetch(`${base}/api/characters/${character.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia', relation: 'ami' }),
      })
      assert.equal(put.status, 200)
      assert.equal(((await put.json()) as Character).relation, 'ami')

      const missing = await fetch(`${base}/api/characters/${randomUUID()}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Personne' }),
      })
      assert.equal(missing.status, 404)
    })
  })

  test('DELETE → 204 puis la fiche a disparu, 404 sur id inconnu', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const created = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      const character = (await created.json()) as Character

      const del = await fetch(`${base}/api/characters/${character.id}`, { method: 'DELETE' })
      assert.equal(del.status, 204)

      const again = await fetch(`${base}/api/characters/${character.id}`, { method: 'DELETE' })
      assert.equal(again.status, 404)
    })
  })
})
