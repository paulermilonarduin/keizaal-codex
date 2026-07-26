import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { openDb, SCHEMA_VERSION } from '../server/db.ts'
import * as notesRepo from '../server/repositories/notes.repo.ts'
import { createNotesService } from '../server/services/notes.service.ts'
import { createApp } from '../server/server.ts'
import { withServer } from './helpers.ts'

function makeService() {
  const db = openDb(':memory:')
  return { db, notes: createNotesService({ db, notesRepo }) }
}

describe('notes.repo — stockage dans meta', () => {
  test('renvoie une chaîne vide sur une base neuve', () => {
    const db = openDb(':memory:')
    assert.equal(notesRepo.read(db), '')
  })

  test('écrit puis relit', () => {
    const db = openDb(':memory:')
    notesRepo.write(db, 'Retrouver Lydia à Blancherive')
    assert.equal(notesRepo.read(db), 'Retrouver Lydia à Blancherive')
  })

  test('la seconde écriture remplace la première (upsert sur la clé)', () => {
    const db = openDb(':memory:')
    notesRepo.write(db, 'premier')
    notesRepo.write(db, 'second')
    assert.equal(notesRepo.read(db), 'second')
  })

  // La clé vit dans meta, à côté de schema_version : l'écrire ne doit surtout
  // pas perturber le mécanisme de migration.
  test('n’altère pas la version de schéma', () => {
    const db = openDb(':memory:')
    notesRepo.write(db, 'du texte')
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    assert.equal(Number(row.value), SCHEMA_VERSION)
  })
})

describe('notes.service', () => {
  test('list renvoie une chaîne vide au départ', () => {
    const { notes } = makeService()
    assert.equal(notes.get(), '')
  })

  test('save valide, enregistre et renvoie la valeur', () => {
    const { notes } = makeService()
    assert.equal(notes.save({ text: 'Bjorn est un allié' }), 'Bjorn est un allié')
    assert.equal(notes.get(), 'Bjorn est un allié')
  })

  test('accepte un texte vide (effacer ses notes est légitime)', () => {
    const { notes } = makeService()
    notes.save({ text: 'quelque chose' })
    assert.equal(notes.save({ text: '' }), '')
  })

  test('conserve les espaces et retours à la ligne tels quels', () => {
    const { notes } = makeService()
    const texte = '  ligne 1\n\n  ligne 2  '
    assert.equal(notes.save({ text: texte }), texte)
  })

  test('refuse un corps sans texte', () => {
    const { notes } = makeService()
    assert.throws(() => notes.save({}))
  })

  test('refuse un texte au-delà de la limite haute', () => {
    const { notes } = makeService()
    assert.throws(() => notes.save({ text: 'x'.repeat(100_001) }))
  })

  test('accepte un texte pile à la limite', () => {
    const { notes } = makeService()
    assert.equal(notes.save({ text: 'x'.repeat(100_000) }).length, 100_000)
  })
})

describe('API des notes', () => {
  test('GET /api/data inclut les notes', async () => {
    const db = openDb(':memory:')
    notesRepo.write(db, 'mes notes')
    await withServer(createApp(db), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data`)
      const body = (await response.json()) as { notes: string }
      assert.equal(response.status, 200)
      assert.equal(body.notes, 'mes notes')
    })
  })

  test('PUT /api/notes enregistre et renvoie 200', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'écrit par l’API' }),
      })
      assert.equal(response.status, 200)
      assert.equal(notesRepo.read(db), 'écrit par l’API')
    })
  })

  test('PUT /api/notes refuse un texte trop long avec 400', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(100_001) }),
      })
      assert.equal(response.status, 400)
    })
  })
})
