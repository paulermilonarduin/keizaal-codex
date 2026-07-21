import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDb } from '../server/db.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import { createCharactersService } from '../server/services/characters.service.ts'
import { createAvatarsService } from '../server/services/avatars.service.ts'
import { NotFoundError, ValidationError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'
import type { Character } from '../shared/schemas.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-avatars-test-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

function makeServices(avatarsDir: string) {
  const db = openDb(':memory:')
  const characters = createCharactersService({ db, charactersRepo })
  const avatars = createAvatarsService({ db, charactersRepo, avatarsDir })
  return { db, characters, avatars }
}

describe('avatars.service — upload', () => {
  test('écrit le fichier <uuid>.webp et met à jour la fiche', async () => {
    const dir = join(tempDir, randomUUID())
    const { characters, avatars } = makeServices(dir)
    const character = characters.create({ name: 'Lydia' })
    const bytes = Buffer.from([1, 2, 3, 4])

    const updated = await avatars.upload(character.id, bytes)

    assert.equal(updated.avatar, `avatars/${character.id}.webp`)
    const written = readFileSync(join(dir, `${character.id}.webp`))
    assert.deepEqual(written, bytes)
  })

  test('id non-UUID → ValidationError, sans toucher au disque', async () => {
    const dir = join(tempDir, randomUUID())
    const { avatars } = makeServices(dir)

    await assert.rejects(() => avatars.upload('../../evil', Buffer.from([1])), ValidationError)
    assert.equal(existsSync(dir), false)
  })

  test('fiche inexistante (UUID valide) → NotFoundError', async () => {
    const dir = join(tempDir, randomUUID())
    const { avatars } = makeServices(dir)

    await assert.rejects(() => avatars.upload(randomUUID(), Buffer.from([1])), NotFoundError)
    assert.equal(existsSync(dir), false)
  })

  test('un second upload remplace le fichier précédent', async () => {
    const dir = join(tempDir, randomUUID())
    const { characters, avatars } = makeServices(dir)
    const character = characters.create({ name: 'Lydia' })

    await avatars.upload(character.id, Buffer.from([1, 1, 1]))
    await avatars.upload(character.id, Buffer.from([2, 2]))

    const written = readFileSync(join(dir, `${character.id}.webp`))
    assert.deepEqual(written, Buffer.from([2, 2]))
  })
})

describe('avatars.service — suppression', () => {
  test('supprime le fichier et efface le champ avatar', async () => {
    const dir = join(tempDir, randomUUID())
    const { characters, avatars } = makeServices(dir)
    const character = characters.create({ name: 'Lydia' })
    await avatars.upload(character.id, Buffer.from([1]))

    await avatars.remove(character.id)

    assert.equal(existsSync(join(dir, `${character.id}.webp`)), false)
    assert.equal(characters.get(character.id).avatar, undefined)
  })

  test('idempotente si le fichier est déjà absent', async () => {
    const dir = join(tempDir, randomUUID())
    const { characters, avatars } = makeServices(dir)
    const character = characters.create({ name: 'Lydia' })

    await assert.doesNotReject(() => avatars.remove(character.id))
  })

  test('id non-UUID → ValidationError', async () => {
    const dir = join(tempDir, randomUUID())
    const { avatars } = makeServices(dir)
    await assert.rejects(() => avatars.remove('pas-un-uuid'), ValidationError)
  })

  test('fiche inexistante (UUID valide) → NotFoundError', async () => {
    const dir = join(tempDir, randomUUID())
    const { avatars } = makeServices(dir)
    await assert.rejects(() => avatars.remove(randomUUID()), NotFoundError)
  })
})

describe('API /api/avatars — statuts HTTP', () => {
  test('POST avec id invalide → 400, sans toucher au disque', async () => {
    const dir = join(tempDir, randomUUID())
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir: dir }), async (base) => {
      const res = await fetch(`${base}/api/avatars/pas-un-uuid`, {
        method: 'POST',
        body: Buffer.from([1, 2, 3]),
      })
      assert.equal(res.status, 400)
    })
    assert.equal(existsSync(dir), false)
  })

  test('POST sur fiche inexistante → 404', async () => {
    const dir = join(tempDir, randomUUID())
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir: dir }), async (base) => {
      const res = await fetch(`${base}/api/avatars/${randomUUID()}`, {
        method: 'POST',
        body: Buffer.from([1, 2, 3]),
      })
      assert.equal(res.status, 404)
    })
  })

  test('POST valide → 200 avec la fiche à jour, DELETE → 204 puis 404 sur le suivant', async () => {
    const dir = join(tempDir, randomUUID())
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir: dir }), async (base) => {
      const created = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      const character = (await created.json()) as Character

      const uploaded = await fetch(`${base}/api/avatars/${character.id}`, {
        method: 'POST',
        body: Buffer.from([9, 9, 9]),
      })
      assert.equal(uploaded.status, 200)
      const withAvatar = (await uploaded.json()) as Character
      assert.equal(withAvatar.avatar, `avatars/${character.id}.webp`)

      const deleted = await fetch(`${base}/api/avatars/${character.id}`, { method: 'DELETE' })
      assert.equal(deleted.status, 204)

      const deletedAgain = await fetch(`${base}/api/avatars/${randomUUID()}`, { method: 'DELETE' })
      assert.equal(deletedAgain.status, 404)
    })
  })

  test('un avatar uploadé est ensuite servi via /avatars/<fichier> (staticRoots + avatarsDir alignés)', async () => {
    const root = join(tempDir, randomUUID())
    const avatarsDir = join(root, 'avatars')
    const db = openDb(':memory:')
    await withServer(createApp(db, { avatarsDir, staticRoots: [root] }), async (base) => {
      const created = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      const character = (await created.json()) as Character

      await fetch(`${base}/api/avatars/${character.id}`, {
        method: 'POST',
        body: Buffer.from([9, 9, 9]),
      })

      const served = await fetch(`${base}/avatars/${character.id}.webp`)
      assert.equal(served.status, 200)
      assert.match(served.headers.get('content-type') ?? '', /image\/webp/)
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), Buffer.from([9, 9, 9]))
    })
  })
})
