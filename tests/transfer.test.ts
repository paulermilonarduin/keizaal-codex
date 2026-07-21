import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDb } from '../server/db.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import * as poisRepo from '../server/repositories/pois.repo.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { createGroupsService } from '../server/services/groups.service.ts'
import { createPoisService } from '../server/services/pois.service.ts'
import { createTransferService } from '../server/services/transfer.service.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { TransferBundle } from '../shared/schemas.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-transfer-test-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

function makeSetup(avatarsDir: string) {
  const db = openDb(':memory:')
  const characters = createCharactersService({ db, charactersRepo })
  const groups = createGroupsService({ db, groupsRepo })
  const pois = createPoisService({ db, poisRepo })
  const transfer = createTransferService({ db, charactersRepo, groupsRepo, poisRepo, avatarsDir })
  return { db, characters, groups, pois, transfer }
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
}

describe('transfer.service — export', () => {
  test('produit un bundle avec characters, groups, pois et avatars en base64', async () => {
    const sourceAvatars = join(tempDir, randomUUID())
    const { characters, groups, pois, transfer, db } = makeSetup(sourceAvatars)
    const group = groups.create({ name: 'Compagnons' })
    const character = characters.create({ name: 'Lydia', groups: [group.id] })
    pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })

    const avatarsService = await import('../server/services/avatars.service.ts')
    await avatarsService
      .createAvatarsService({ db, charactersRepo, avatarsDir: sourceAvatars })
      .upload(character.id, Buffer.from([9, 9, 9]))

    const bundle = await transfer.exportBundle()

    assert.equal(bundle.characters.length, 1)
    assert.equal(bundle.groups.length, 1)
    assert.equal(bundle.pois.length, 1)
    const filename = `${character.id}.webp`
    assert.equal(bundle.avatars[filename], Buffer.from([9, 9, 9]).toString('base64'))
  })
})

describe('transfer.service — round-trip export → import replace', () => {
  test('sur une base vierge, les données sont identiques', async () => {
    const sourceAvatars = join(tempDir, randomUUID())
    const targetAvatars = join(tempDir, randomUUID())
    const source = makeSetup(sourceAvatars)

    const group = source.groups.create({ name: 'Compagnons', color: '#c0392b' })
    const character = source.characters.create({
      gameId: '#48213',
      name: 'Compte-les-Sous',
      groups: [group.id],
      homePosition: { x: 10, y: 20, label: 'Blancherive' },
    })
    source.pois.create({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })

    const avatarsService = await import('../server/services/avatars.service.ts')
    await avatarsService
      .createAvatarsService({ db: source.db, charactersRepo, avatarsDir: sourceAvatars })
      .upload(character.id, Buffer.from([7, 7, 7]))

    const bundle = await source.transfer.exportBundle()

    const target = makeSetup(targetAvatars)
    await target.transfer.importBundle(bundle, 'replace')

    assert.deepEqual(sortById(target.characters.list()), sortById(source.characters.list()))
    assert.deepEqual(sortById(target.groups.list()), sortById(source.groups.list()))
    assert.deepEqual(sortById(target.pois.list()), sortById(source.pois.list()))
    const imported = readFileSync(join(targetAvatars, `${character.id}.webp`))
    assert.deepEqual(imported, Buffer.from([7, 7, 7]))
  })

  test('purge les données existantes de la cible avant import', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    target.characters.create({ name: 'Sera effacé' })
    const source = makeSetup(join(tempDir, randomUUID()))
    source.characters.create({ name: 'Nouveau' })

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'replace')

    const names = target.characters.list().map((c) => c.name)
    assert.deepEqual(names, ['Nouveau'])
  })
})

describe('transfer.service — import merge', () => {
  test('un personnage sans correspondance est créé', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    const source = makeSetup(join(tempDir, randomUUID()))
    source.characters.create({ name: 'Lydia' })

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'merge')

    assert.equal(target.characters.list().length, 1)
    assert.equal(target.characters.list()[0]?.name, 'Lydia')
  })

  test('correspondance par gameId : met à jour la fiche existante sans la dupliquer', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    const existing = target.characters.create({ gameId: '#111', name: 'Ancien nom' })

    const source = makeSetup(join(tempDir, randomUUID()))
    source.characters.create({ gameId: '#111', name: 'Nouveau nom' })

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'merge')

    const all = target.characters.list()
    assert.equal(all.length, 1)
    assert.equal(all[0]?.name, 'Nouveau nom')
    assert.equal(all[0]?.id, existing.id)
  })

  test('sans gameId, correspondance par id interne', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    const existing = target.characters.create({ name: 'Ancien nom' })

    const source = makeSetup(join(tempDir, randomUUID()))
    // Même id que la fiche cible : simule un re-import du même personnage.
    source.db
      .prepare('UPDATE characters SET id = ? WHERE id = ?')
      .run(existing.id, source.characters.create({ name: 'Nouveau nom' }).id)

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'merge')

    const all = target.characters.list()
    assert.equal(all.length, 1)
    assert.equal(all[0]?.name, 'Nouveau nom')
  })

  test('conserve un groupe existant non présent dans le bundle', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    target.groups.create({ name: 'Compagnons' })
    const source = makeSetup(join(tempDir, randomUUID()))
    source.groups.create({ name: 'Voleurs' })

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'merge')

    const names = target.groups.list().map((g) => g.name).sort()
    assert.deepEqual(names, ['Compagnons', 'Voleurs'])
  })

  test('préserve l’avatar existant quand la fiche importée n’en a pas', async () => {
    const targetAvatars = join(tempDir, randomUUID())
    const target = makeSetup(targetAvatars)
    const existing = target.characters.create({ gameId: '#111', name: 'Lydia' })
    const avatarsService = await import('../server/services/avatars.service.ts')
    await avatarsService
      .createAvatarsService({ db: target.db, charactersRepo, avatarsDir: targetAvatars })
      .upload(existing.id, Buffer.from([5]))

    const source = makeSetup(join(tempDir, randomUUID()))
    source.characters.create({ gameId: '#111', name: 'Lydia (renommée)' })

    await target.transfer.importBundle(await source.transfer.exportBundle(), 'merge')

    assert.equal(target.characters.get(existing.id).avatar, `avatars/${existing.id}.webp`)
    assert.equal(existsSync(join(targetAvatars, `${existing.id}.webp`)), true)
  })
})

describe('transfer.service — atomicité', () => {
  test('replace : un import invalide ne laisse aucune trace, les données existantes survivent', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    target.characters.create({ name: 'Doit survivre' })

    const brokenBundle: TransferBundle = {
      exportedAt: new Date().toISOString(),
      characters: [
        {
          id: randomUUID(),
          name: 'Cassé',
          race: 'Inconnue',
          relation: 'inconnu',
          groups: [randomUUID()], // groupe inexistant → violation de contrainte FK
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      groups: [],
      pois: [],
      avatars: {},
    }

    await assert.rejects(() => target.transfer.importBundle(brokenBundle, 'replace'))
    const names = target.characters.list().map((c) => c.name)
    assert.deepEqual(names, ['Doit survivre'])
  })

  test('merge : un import invalide ne laisse aucune trace', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    target.characters.create({ name: 'Doit survivre' })

    const brokenBundle: TransferBundle = {
      exportedAt: new Date().toISOString(),
      characters: [
        {
          id: randomUUID(),
          name: 'Cassé',
          race: 'Inconnue',
          relation: 'inconnu',
          groups: [randomUUID()],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      groups: [],
      pois: [],
      avatars: {},
    }

    await assert.rejects(() => target.transfer.importBundle(brokenBundle, 'merge'))
    const names = target.characters.list().map((c) => c.name)
    assert.deepEqual(names, ['Doit survivre'])
  })

  test('bundle malformé (zod) → rejette avant tout accès disque ou base', async () => {
    const target = makeSetup(join(tempDir, randomUUID()))
    await assert.rejects(() => target.transfer.importBundle({ nimporte: 'quoi' }, 'replace'))
    assert.equal(target.characters.list().length, 0)
  })
})

describe('API /api/export et /api/import', () => {
  test('GET /api/export renvoie un bundle exploitable', async () => {
    const avatarsDir = join(tempDir, randomUUID())
    const db = openDb(':memory:')
    const charactersService = createCharactersService({ db, charactersRepo })
    charactersService.create({ name: 'Lydia' })

    await withServer(createApp(db, { avatarsDir }), async (base) => {
      const res = await fetch(`${base}/api/export`)
      assert.equal(res.status, 200)
      const bundle = (await res.json()) as TransferBundle
      assert.equal(bundle.characters.length, 1)
    })
  })

  test('POST /api/import sans mode valide → 400', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir: join(tempDir, randomUUID()) }), async (base) => {
      const res = await fetch(`${base}/api/import?mode=n_importe_quoi`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      assert.equal(res.status, 400)
    })
  })

  test('POST /api/import?mode=replace → 200 et les données apparaissent', async () => {
    const avatarsDir = join(tempDir, randomUUID())
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir }), async (base) => {
      const bundle: TransferBundle = {
        exportedAt: new Date().toISOString(),
        characters: [
          {
            id: randomUUID(),
            name: 'Lydia',
            race: 'Inconnue',
            relation: 'inconnu',
            groups: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        groups: [],
        pois: [],
        avatars: {},
      }
      const res = await fetch(`${base}/api/import?mode=replace`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bundle),
      })
      assert.equal(res.status, 200)

      const data = await fetch(`${base}/api/data`)
      const body = (await data.json()) as { characters: { name?: string }[] }
      assert.equal(body.characters[0]?.name, 'Lydia')
    })
  })
})
