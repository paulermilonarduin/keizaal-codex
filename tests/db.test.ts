import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { openDb, transaction, MIGRATIONS, SCHEMA_VERSION } from '../server/db.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-db-test-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

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
    db.close()
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
    const count = countRows(db2, 'characters')
    const row = db2
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    db2.close()
    assert.equal(count, 1)
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

describe('migration de purge des POI', () => {
  test('une base neuve démarre sans aucun POI (plus de seed)', () => {
    const db = openDb(':memory:')
    assert.equal(countRows(db, 'pois'), 0)
  })

  test('vide les POI d’une base créée avant la migration, sans toucher au reste', () => {
    const path = join(tempDir, 'purge.db')

    // Simule une base au schéma v1 : les tables d'origine, des POI hérités du
    // seed, et des données utilisateur qui doivent survivre.
    const legacy = new DatabaseSync(path)
    legacy.exec('PRAGMA foreign_keys = ON')
    legacy.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')
    const schemaV1 = MIGRATIONS[0]
    assert.ok(schemaV1 !== undefined, 'la migration initiale doit exister')
    legacy.exec(schemaV1)
    legacy.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '1')").run()
    legacy.prepare('INSERT INTO pois (id, name, type, x, y) VALUES (?, ?, ?, ?, ?)').run(
      randomUUID(),
      'Blancherive',
      'capitale',
      2450,
      3100,
    )
    legacy.prepare('INSERT INTO characters (id, name) VALUES (?, ?)').run(randomUUID(), 'Lydia')
    legacy.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(randomUUID(), 'Compagnons')
    legacy.close()

    const db = openDb(path)
    const pois = countRows(db, 'pois')
    const characters = countRows(db, 'characters')
    const groups = countRows(db, 'groups')
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    db.close()

    assert.equal(pois, 0, 'les POI hérités doivent être purgés')
    assert.equal(characters, 1, 'les personnages doivent survivre')
    assert.equal(groups, 1, 'les groupes doivent survivre')
    assert.equal(Number(version.value), SCHEMA_VERSION)
  })

  test('ne rejoue pas la purge : un POI créé après migration survit', () => {
    const path = join(tempDir, 'apres-purge.db')
    const db1 = openDb(path)
    db1.prepare('INSERT INTO pois (id, name, type, x, y) VALUES (?, ?, ?, ?, ?)').run(
      randomUUID(),
      'Mon lieu',
      'landmark',
      10,
      20,
    )
    db1.close()

    const db2 = openDb(path)
    const count = countRows(db2, 'pois')
    db2.close()
    assert.equal(count, 1)
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
