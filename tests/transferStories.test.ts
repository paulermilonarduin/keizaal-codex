import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from '../server/db.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import * as poisRepo from '../server/repositories/pois.repo.ts'
import * as notesRepo from '../server/repositories/notes.repo.ts'
import * as storiesRepo from '../server/repositories/stories.repo.ts'
import { createTransferService } from '../server/services/transfer.service.ts'
import { transferBundleSchema } from '../shared/schemas.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-stories-transfer-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

function makeSetup() {
  const db = openDb(':memory:')
  const transfer = createTransferService({
    db,
    charactersRepo,
    groupsRepo,
    poisRepo,
    notesRepo,
    storiesRepo,
    avatarsDir: join(tempDir, randomUUID()),
  })
  return { db, transfer }
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

// Peuple une base d'un personnage, un groupe, un lieu et une histoire qui lie
// les trois. Renvoie les ids pour que les tests vérifient les liens.
function seedLinkedStory(db: DatabaseSync, gameId?: string) {
  const characterId = randomUUID()
  const groupId = randomUUID()
  const poiId = randomUUID()
  const storyId = randomUUID()
  const now = new Date().toISOString()

  charactersRepo.insert(db, {
    id: characterId,
    gameId,
    name: 'Lydia',
    race: 'Nordique',
    relation: 'ami',
    groups: [],
    createdAt: now,
    updatedAt: now,
  })
  groupsRepo.insert(db, { id: groupId, name: 'Compagnons', notes: '' })
  poisRepo.insert(db, { id: poiId, name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
  storiesRepo.insert(db, {
    id: storyId,
    title: 'Le siège de Blancherive',
    date: '2026-07-17',
    notes: 'Une nuit de feu.',
    characters: [characterId],
    groups: [groupId],
    pois: [poiId],
  })
  storiesRepo.setLinks(db, storyId, { characters: [characterId], groups: [groupId], pois: [poiId] })

  return { characterId, groupId, poiId, storyId }
}

describe('histoires dans le bundle de transfert', () => {
  test('l’export embarque les histoires et leurs liens', async () => {
    const { db, transfer } = makeSetup()
    const { characterId, groupId, poiId } = seedLinkedStory(db)

    const bundle = await transfer.exportBundle()

    assert.equal(bundle.stories.length, 1)
    assert.equal(bundle.stories[0]?.title, 'Le siège de Blancherive')
    assert.equal(bundle.stories[0]?.date, '2026-07-17')
    assert.deepEqual(bundle.stories[0]?.characters, [characterId])
    assert.deepEqual(bundle.stories[0]?.groups, [groupId])
    assert.deepEqual(bundle.stories[0]?.pois, [poiId])
  })

  // Rétrocompatibilité : les fichiers exportés avant #83 n'ont pas la clé, même
  // règle que `notes` au ticket #72.
  test('le schéma accepte un bundle sans la clé stories et applique un tableau vide', () => {
    const parsed = transferBundleSchema.parse({
      exportedAt: new Date().toISOString(),
      characters: [],
      groups: [],
      pois: [],
      avatars: {},
    })

    assert.deepEqual(parsed.stories, [])
  })

  test('un import replace d’un ancien fichier vide les histoires sans échouer', async () => {
    const { db, transfer } = makeSetup()
    seedLinkedStory(db)

    await transfer.importBundle(
      {
        exportedAt: new Date().toISOString(),
        characters: [],
        groups: [],
        pois: [],
        avatars: {},
      },
      'replace',
    )

    assert.equal(countRows(db, 'stories'), 0)
  })

  test('round-trip export → import replace conserve histoires et liens', async () => {
    const source = makeSetup()
    const seeded = seedLinkedStory(source.db)
    const bundle = await source.transfer.exportBundle()

    const target = makeSetup()
    await target.transfer.importBundle(bundle, 'replace')

    const imported = storiesRepo.findAll(target.db)
    assert.equal(imported.length, 1)
    assert.deepEqual(imported[0], {
      id: seeded.storyId,
      title: 'Le siège de Blancherive',
      date: '2026-07-17',
      notes: 'Une nuit de feu.',
      characters: [seeded.characterId],
      groups: [seeded.groupId],
      pois: [seeded.poiId],
    })
  })

  test('import merge : histoire connue mise à jour, histoire nouvelle créée', async () => {
    const target = makeSetup()
    const known = randomUUID()
    storiesRepo.insert(target.db, {
      id: known,
      title: 'Titre local',
      notes: '',
      characters: [],
      groups: [],
      pois: [],
    })

    await target.transfer.importBundle(
      {
        exportedAt: new Date().toISOString(),
        characters: [],
        groups: [],
        pois: [],
        avatars: {},
        stories: [
          {
            id: known,
            title: 'Titre du fichier',
            notes: 'importées',
            characters: [],
            groups: [],
            pois: [],
          },
          {
            id: randomUUID(),
            title: 'Nouvelle histoire',
            notes: '',
            characters: [],
            groups: [],
            pois: [],
          },
        ],
      },
      'merge',
    )

    const titles = storiesRepo
      .findAll(target.db)
      .map((story) => story.title)
      .sort()
    assert.deepEqual(titles, ['Nouvelle histoire', 'Titre du fichier'])
    assert.equal(storiesRepo.findById(target.db, known)?.notes, 'importées')
  })

  // LE test du remap : mergeCharacter rapproche par gameId et garde l'id local.
  // Sans remapper les liens du bundle, l'histoire pointerait un id qui n'existe
  // pas en base et la contrainte FK ferait échouer tout l'import.
  test('import merge : les liens suivent le personnage rapproché par gameId', async () => {
    const target = makeSetup()
    const localId = randomUUID()
    const now = new Date().toISOString()
    charactersRepo.insert(target.db, {
      id: localId,
      gameId: '#12345',
      name: 'Lydia',
      race: 'Nordique',
      relation: 'ami',
      groups: [],
      createdAt: now,
      updatedAt: now,
    })

    const bundleId = randomUUID()
    const storyId = randomUUID()
    await target.transfer.importBundle(
      {
        exportedAt: now,
        characters: [
          {
            id: bundleId,
            gameId: '#12345',
            name: 'Lydia la fidèle',
            race: 'Nordique',
            relation: 'ami',
            groups: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        groups: [],
        pois: [],
        avatars: {},
        stories: [
          {
            id: storyId,
            title: 'Le siège',
            notes: '',
            characters: [bundleId],
            groups: [],
            pois: [],
          },
        ],
      },
      'merge',
    )

    assert.deepEqual(storiesRepo.findById(target.db, storyId)?.characters, [localId])
    assert.equal(charactersRepo.findAll(target.db).length, 1, 'aucune fiche dupliquée')
  })

  test('import atomique : une histoire liant un id inexistant rejette tout', async () => {
    const { db, transfer } = makeSetup()
    const seeded = seedLinkedStory(db)

    await assert.rejects(() =>
      transfer.importBundle(
        {
          exportedAt: new Date().toISOString(),
          characters: [],
          groups: [],
          pois: [],
          avatars: {},
          stories: [
            {
              id: randomUUID(),
              title: 'Cassée',
              notes: '',
              characters: [randomUUID()],
              groups: [],
              pois: [],
            },
          ],
        },
        'merge',
      ),
    )

    assert.equal(countRows(db, 'stories'), 1)
    assert.equal(storiesRepo.findById(db, seeded.storyId)?.title, 'Le siège de Blancherive')
  })
})
