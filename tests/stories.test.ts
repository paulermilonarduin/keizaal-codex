import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../server/db.ts'
import * as storiesRepo from '../server/repositories/stories.repo.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import * as poisRepo from '../server/repositories/pois.repo.ts'
import { createStoriesService } from '../server/services/stories.service.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { createGroupsService } from '../server/services/groups.service.ts'
import { createPoisService } from '../server/services/pois.service.ts'
import { NotFoundError, ValidationError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { Story } from '../shared/schemas.ts'

function makeServices() {
  const db = openDb(':memory:')
  return {
    db,
    stories: createStoriesService({ db, storiesRepo }),
    characters: createCharactersService({ db, charactersRepo }),
    groups: createGroupsService({ db, groupsRepo }),
    pois: createPoisService({ db, poisRepo }),
  }
}

// Copie assumée de groups.test.ts : trois lignes d'assertion locale ne valent
// pas un helper partagé entre fichiers de test.
function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

describe('stories.service — CRUD', () => {
  test('créer une histoire avec le titre seul applique les défauts', () => {
    const { stories } = makeServices()
    const story = stories.create({ title: 'La chute de Blancherive' })

    assert.match(story.id, /^[0-9a-f-]{36}$/)
    assert.equal(story.title, 'La chute de Blancherive')
    // Une histoire peut exister sans aucun lien : seul le titre est requis (#83).
    assert.equal(story.date, undefined)
    assert.equal(story.notes, '')
    assert.deepEqual(story.characters, [])
    assert.deepEqual(story.groups, [])
    assert.deepEqual(story.pois, [])
  })

  test('créer une histoire liée relit les liens hydratés', () => {
    const { db, stories, characters, groups, pois } = makeServices()
    const lydia = characters.create({ name: 'Lydia' })
    const balgruuf = characters.create({ name: 'Balgruuf' })
    const compagnons = groups.create({ name: 'Compagnons' })
    const blancherive = pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })

    const story = stories.create({
      title: 'Le siège',
      date: '2026-07-17',
      notes: 'Une nuit de feu.',
      characters: [lydia.id, balgruuf.id],
      groups: [compagnons.id],
      pois: [blancherive.id],
    })

    assert.deepEqual(story.characters, [lydia.id, balgruuf.id])
    assert.deepEqual(story.groups, [compagnons.id])
    assert.deepEqual(story.pois, [blancherive.id])
    assert.deepEqual(stories.get(story.id), story)
    assert.equal(countRows(db, 'story_characters'), 2)
    assert.equal(countRows(db, 'story_groups'), 1)
    assert.equal(countRows(db, 'story_pois'), 1)
  })

  test('refuse une histoire sans titre', () => {
    const { stories } = makeServices()
    assert.throws(() => stories.create({}))
  })

  test('refuse une date qui n’est pas au format AAAA-MM-JJ', () => {
    const { stories } = makeServices()
    // Décision #83 : la date est une date ISO (<input type="date">), pas du
    // texte libre au calendrier de Tamriel.
    assert.throws(() => stories.create({ title: 'Le siège', date: '17 Ondepluie 4E 203' }))
  })

  test('update remplace titre, date, notes et liens', () => {
    const { db, stories, characters, pois } = makeServices()
    const lydia = characters.create({ name: 'Lydia' })
    const balgruuf = characters.create({ name: 'Balgruuf' })
    const blancherive = pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
    const story = stories.create({
      title: 'Brouillon',
      date: '2026-07-17',
      notes: 'à compléter',
      characters: [lydia.id],
    })

    const updated = stories.update(story.id, {
      title: 'Le siège de Blancherive',
      date: '2026-07-18',
      notes: 'Une nuit de feu.',
      characters: [balgruuf.id],
      pois: [blancherive.id],
    })

    assert.equal(updated.id, story.id)
    assert.equal(updated.title, 'Le siège de Blancherive')
    assert.equal(updated.date, '2026-07-18')
    assert.equal(updated.notes, 'Une nuit de feu.')
    assert.deepEqual(updated.characters, [balgruuf.id])
    assert.deepEqual(updated.pois, [blancherive.id])
    // Les anciens liens ont bien disparu, ils ne se cumulent pas.
    assert.equal(countRows(db, 'story_characters'), 1)
    assert.equal(countRows(db, 'story_pois'), 1)
  })

  test('update peut retirer la date', () => {
    const { stories } = makeServices()
    const story = stories.create({ title: 'Le siège', date: '2026-07-17' })

    const updated = stories.update(story.id, { title: 'Le siège' })

    assert.equal(updated.date, undefined)
  })

  test('lier un id inexistant rejette et n’écrit rien', () => {
    const { db, stories } = makeServices()

    assert.throws(
      () => stories.create({ title: 'Le siège', characters: [randomUUID()] }),
      ValidationError,
    )
    // Entité et liens partagent une transaction : l'échec de la liaison ne
    // laisse pas une histoire orpheline derrière lui.
    assert.equal(countRows(db, 'stories'), 0)
  })

  test('supprimer une histoire purge ses liaisons mais PAS les entités liées', () => {
    const { db, stories, characters, groups, pois } = makeServices()
    const lydia = characters.create({ name: 'Lydia' })
    const compagnons = groups.create({ name: 'Compagnons' })
    const blancherive = pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
    const story = stories.create({
      title: 'Le siège',
      characters: [lydia.id],
      groups: [compagnons.id],
      pois: [blancherive.id],
    })

    stories.remove(story.id)

    assert.equal(countRows(db, 'stories'), 0)
    assert.equal(countRows(db, 'story_characters'), 0)
    assert.equal(countRows(db, 'story_groups'), 0)
    assert.equal(countRows(db, 'story_pois'), 0)
    assert.equal(characters.get(lydia.id).name, 'Lydia')
    assert.equal(groups.get(compagnons.id).name, 'Compagnons')
    assert.equal(pois.get(blancherive.id).name, 'Blancherive')
  })

  test('supprimer un personnage retire le lien sans supprimer l’histoire', () => {
    const { stories, characters } = makeServices()
    const lydia = characters.create({ name: 'Lydia' })
    const story = stories.create({ title: 'Le siège', characters: [lydia.id] })

    characters.remove(lydia.id)

    const reloaded = stories.get(story.id)
    assert.deepEqual(reloaded.characters, [])
    assert.equal(reloaded.title, 'Le siège')
  })

  test('supprimer un groupe retire le lien sans supprimer l’histoire', () => {
    const { stories, groups } = makeServices()
    const compagnons = groups.create({ name: 'Compagnons' })
    const story = stories.create({ title: 'Le siège', groups: [compagnons.id] })

    groups.remove(compagnons.id)

    const reloaded = stories.get(story.id)
    assert.deepEqual(reloaded.groups, [])
    assert.equal(reloaded.title, 'Le siège')
  })

  test('supprimer un lieu retire le lien sans supprimer l’histoire', () => {
    const { stories, pois } = makeServices()
    const blancherive = pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
    const story = stories.create({ title: 'Le siège', pois: [blancherive.id] })

    pois.remove(blancherive.id)

    const reloaded = stories.get(story.id)
    assert.deepEqual(reloaded.pois, [])
    assert.equal(reloaded.title, 'Le siège')
  })

  test('update et remove d’un id inconnu → introuvable', () => {
    const { stories } = makeServices()
    assert.throws(() => stories.update(randomUUID(), { title: 'X' }), NotFoundError)
    assert.throws(() => stories.remove(randomUUID()), NotFoundError)
  })
})

describe('API /api/stories — statuts HTTP', () => {
  test('POST → 201, invalide → 400, PUT → 200, DELETE → 204, inconnus → 404', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const created = await fetch(`${base}/api/stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Le siège de Blancherive' }),
      })
      assert.equal(created.status, 201)
      const story = (await created.json()) as Story

      const invalid = await fetch(`${base}/api/stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'sans titre' }),
      })
      assert.equal(invalid.status, 400)

      const put = await fetch(`${base}/api/stories/${story.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Renommée', notes: 'Une nuit de feu.' }),
      })
      assert.equal(put.status, 200)

      const putMissing = await fetch(`${base}/api/stories/${randomUUID()}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'X' }),
      })
      assert.equal(putMissing.status, 404)

      const del = await fetch(`${base}/api/stories/${story.id}`, { method: 'DELETE' })
      assert.equal(del.status, 204)

      const delMissing = await fetch(`${base}/api/stories/${story.id}`, { method: 'DELETE' })
      assert.equal(delMissing.status, 404)
    })
  })
})

describe('API /api/data', () => {
  test('expose les histoires avec leurs liens', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const characterRes = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      const character = (await characterRes.json()) as { id: string }
      await fetch(`${base}/api/stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Le siège', characters: [character.id] }),
      })

      const res = await fetch(`${base}/api/data`)
      const body = (await res.json()) as { stories: Story[] }

      assert.equal(body.stories.length, 1)
      assert.equal(body.stories[0]?.title, 'Le siège')
      assert.deepEqual(body.stories[0]?.characters, [character.id])
    })
  })
})
