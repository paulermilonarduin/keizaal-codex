import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { openDb, transaction, SCHEMA_VERSION } from '../server/db.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-db-test-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

const POIS_SEED = [
  { name: 'Blancherive', type: 'capitale', x: 2450, y: 3100 },
  { name: 'Rivebois', x: 2600, y: 3600 },
]

function insertCharacter(
  db: DatabaseSync,
  { id = randomUUID(), gameId = null, name = null }: { id?: string; gameId?: string | null; name?: string | null } = {},
): string {
  db.prepare('INSERT INTO characters (id, game_id, name) VALUES (?, ?, ?)').run(id, gameId, name)
  return id
}

function insertGroup(db: DatabaseSync, name = 'Compagnons'): string {
  const id = randomUUID()
  db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(id, name)
  return id
}

function linkCharacterToGroup(db: DatabaseSync, characterId: string, groupId: string): void {
  db.prepare('INSERT INTO character_groups (character_id, group_id) VALUES (?, ?)').run(
    characterId,
    groupId,
  )
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

describe('openDb — création du schéma', () => {
  test('crée les 5 tables au premier lancement', () => {
    const db = openDb(':memory:')
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
    assert.deepEqual(
      rows.map((r) => r.name),
      ['character_groups', 'characters', 'groups', 'meta', 'pois'],
    )
  })

  test('active la contrainte des clés étrangères', () => {
    const db = openDb(':memory:')
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    assert.equal(row.foreign_keys, 1)
  })

  test('active le mode WAL sur une base fichier', () => {
    const db = openDb(join(tempDir, 'wal.db'))
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    assert.equal(row.journal_mode, 'wal')
  })

  test('enregistre la version de schéma dans meta', () => {
    const db = openDb(':memory:')
    const row = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    assert.equal(Number(row.value), SCHEMA_VERSION)
  })

  test('rouvrir une base existante conserve les données et la version', () => {
    const path = join(tempDir, 'reopen.db')
    const db1 = openDb(path)
    insertCharacter(db1, { name: 'Lydia' })
    db1.close()

    const db2 = openDb(path)
    assert.equal(countRows(db2, 'characters'), 1)
    const row = db2
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    assert.equal(Number(row.value), SCHEMA_VERSION)
  })
})

describe('contraintes en base', () => {
  test('refuse un personnage sans nom ni gameId (CHECK identité)', () => {
    const db = openDb(':memory:')
    assert.throws(() => insertCharacter(db, {}))
  })

  test('accepte un personnage avec nom seul ou gameId seul', () => {
    const db = openDb(':memory:')
    insertCharacter(db, { name: 'Lydia' })
    insertCharacter(db, { gameId: '#48213' })
    assert.equal(countRows(db, 'characters'), 2)
  })

  test('refuse un gameId en double (UNIQUE)', () => {
    const db = openDb(':memory:')
    insertCharacter(db, { gameId: '#48213' })
    assert.throws(() => insertCharacter(db, { gameId: '#48213' }))
  })

  test('autorise plusieurs personnages sans gameId', () => {
    const db = openDb(':memory:')
    insertCharacter(db, { name: 'Lydia' })
    insertCharacter(db, { name: 'Balgruuf' })
    assert.equal(countRows(db, 'characters'), 2)
  })

  test('applique le défaut relation = inconnu', () => {
    const db = openDb(':memory:')
    const id = insertCharacter(db, { name: 'Lydia' })
    const row = db.prepare('SELECT relation FROM characters WHERE id = ?').get(id) as {
      relation: string
    }
    assert.equal(row.relation, 'inconnu')
  })

  test('supprimer un personnage supprime ses liaisons (cascade), pas ses groupes', () => {
    const db = openDb(':memory:')
    const characterId = insertCharacter(db, { name: 'Lydia' })
    const groupId = insertGroup(db)
    linkCharacterToGroup(db, characterId, groupId)

    db.prepare('DELETE FROM characters WHERE id = ?').run(characterId)
    assert.equal(countRows(db, 'character_groups'), 0)
    assert.equal(countRows(db, 'groups'), 1)
  })

  test('supprimer un groupe supprime ses liaisons (cascade), pas ses personnages', () => {
    const db = openDb(':memory:')
    const characterId = insertCharacter(db, { name: 'Lydia' })
    const groupId = insertGroup(db)
    linkCharacterToGroup(db, characterId, groupId)

    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId)
    assert.equal(countRows(db, 'character_groups'), 0)
    assert.equal(countRows(db, 'characters'), 1)
  })

  test('refuse une liaison vers un personnage inexistant (FK)', () => {
    const db = openDb(':memory:')
    const groupId = insertGroup(db)
    assert.throws(() => linkCharacterToGroup(db, randomUUID(), groupId))
  })
})

describe('seed des POI', () => {
  test('importe le seed au premier lancement avec type par défaut « autre »', () => {
    const db = openDb(':memory:', { poisSeed: POIS_SEED })
    assert.equal(countRows(db, 'pois'), 2)
    const row = db.prepare("SELECT type FROM pois WHERE name = 'Rivebois'").get() as {
      type: string
    }
    assert.equal(row.type, 'autre')
  })

  test('donne un id UUID à chaque POI seedé', () => {
    const db = openDb(':memory:', { poisSeed: POIS_SEED })
    const rows = db.prepare('SELECT id FROM pois').all() as { id: string }[]
    for (const { id } of rows) {
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })

  test('ne réimporte pas le seed sur une base existante', () => {
    const path = join(tempDir, 'seed.db')
    const db1 = openDb(path, { poisSeed: POIS_SEED })
    db1.prepare("DELETE FROM pois WHERE name = 'Rivebois'").run()
    db1.close()

    const db2 = openDb(path, { poisSeed: POIS_SEED })
    assert.equal(countRows(db2, 'pois'), 1)
  })

  test('refuse un seed invalide (validation zod)', () => {
    assert.throws(() => openDb(':memory:', { poisSeed: [{ name: 'Sans coordonnées' }] }))
  })
})

describe('transaction', () => {
  test('committe et retourne la valeur de la fonction', () => {
    const db = openDb(':memory:')
    const result = transaction(db, () => {
      insertCharacter(db, { name: 'Lydia' })
      return 42
    })
    assert.equal(result, 42)
    assert.equal(countRows(db, 'characters'), 1)
  })

  test('annule toutes les écritures si la fonction lance (rollback)', () => {
    const db = openDb(':memory:')
    assert.throws(() =>
      transaction(db, () => {
        insertCharacter(db, { name: 'Lydia' })
        throw new Error('boom')
      }),
    )
    assert.equal(countRows(db, 'characters'), 0)
  })

  test('laisse la base utilisable après un rollback', () => {
    const db = openDb(':memory:')
    try {
      transaction(db, () => {
        throw new Error('boom')
      })
    } catch {
      // rollback attendu
    }
    insertCharacter(db, { name: 'Lydia' })
    assert.equal(countRows(db, 'characters'), 1)
  })
})
