import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../server/db.ts'
import * as charactersRepo from '../server/repositories/characters.repo.ts'
import * as groupsRepo from '../server/repositories/groups.repo.ts'
import * as poisRepo from '../server/repositories/pois.repo.ts'
import * as notesRepo from '../server/repositories/notes.repo.ts'
import { createTransferService } from '../server/services/transfer.service.ts'
import { transferBundleSchema } from '../shared/schemas.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-notes-transfer-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

function makeSetup() {
  const db = openDb(':memory:')
  const transfer = createTransferService({
    db,
    charactersRepo,
    groupsRepo,
    poisRepo,
    notesRepo,
    avatarsDir: join(tempDir, 'avatars'),
  })
  return { db, transfer }
}

describe('notes dans le bundle de transfert', () => {
  test('l’export embarque les notes', async () => {
    const { db, transfer } = makeSetup()
    notesRepo.write(db, 'Notes à exporter')

    const bundle = await transfer.exportBundle()

    assert.equal(bundle.notes, 'Notes à exporter')
  })

  test('l’export d’une base neuve renvoie une chaîne vide', async () => {
    const { transfer } = makeSetup()
    assert.equal((await transfer.exportBundle()).notes, '')
  })

  test('un import replace remplace les notes', async () => {
    const { db, transfer } = makeSetup()
    notesRepo.write(db, 'anciennes notes')

    await transfer.importBundle(
      {
        exportedAt: new Date().toISOString(),
        characters: [],
        groups: [],
        pois: [],
        avatars: {},
        notes: 'notes importées',
      },
      'replace',
    )

    assert.equal(notesRepo.read(db), 'notes importées')
  })

  // Décision du ticket : le merge sert à ajouter des fiches, pas à écraser une
  // note rédigée localement.
  test('un import merge conserve les notes locales', async () => {
    const { db, transfer } = makeSetup()
    notesRepo.write(db, 'mes notes locales')

    await transfer.importBundle(
      {
        exportedAt: new Date().toISOString(),
        characters: [],
        groups: [],
        pois: [],
        avatars: {},
        notes: 'notes du fichier',
      },
      'merge',
    )

    assert.equal(notesRepo.read(db), 'mes notes locales')
  })

  test('un merge sur une base sans notes adopte celles du fichier', async () => {
    const { db, transfer } = makeSetup()

    await transfer.importBundle(
      {
        exportedAt: new Date().toISOString(),
        characters: [],
        groups: [],
        pois: [],
        avatars: {},
        notes: 'notes du fichier',
      },
      'merge',
    )

    assert.equal(notesRepo.read(db), 'notes du fichier')
  })

  // Rétrocompatibilité : les fichiers exportés avant ce ticket n'ont pas la clé.
  test('le schéma accepte un bundle sans notes et applique une chaîne vide', () => {
    const parsed = transferBundleSchema.parse({
      exportedAt: new Date().toISOString(),
      characters: [],
      groups: [],
      pois: [],
      avatars: {},
    })

    assert.equal(parsed.notes, '')
  })

  test('un import replace d’un ancien fichier vide les notes sans échouer', async () => {
    const { db, transfer } = makeSetup()
    notesRepo.write(db, 'anciennes notes')

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

    assert.equal(notesRepo.read(db), '')
  })
})
