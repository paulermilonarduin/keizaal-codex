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
  test('crée les 9 tables au premier lancement', () => {
    const db = openDb(':memory:')
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
    assert.deepEqual(
      rows.map((r) => r.name),
      [
        'character_groups',
        'characters',
        'groups',
        'meta',
        'pois',
        'stories',
        'story_characters',
        'story_groups',
        'story_pois',
      ],
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

// #80 : les deux positions (générale + connue) fusionnent en une seule.
// Décision assumée : seule la position connue est reprise, une fiche qui n'avait
// qu'un domicile se retrouve sans marqueur, à replacer à la main.
describe('migration vers la position unique (#80)', () => {
  function columnsOf(db: DatabaseSync, table: string): string[] {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    return rows.map((row) => row.name)
  }

  // Base au schéma v2 : toutes les migrations sauf celle qu'on teste.
  function openLegacyV2(path: string): DatabaseSync {
    const legacy = new DatabaseSync(path)
    legacy.exec('PRAGMA foreign_keys = ON')
    legacy.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')
    for (const migration of MIGRATIONS.slice(0, 2)) {
      assert.ok(migration !== undefined)
      legacy.exec(migration)
    }
    legacy.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '2')").run()
    return legacy
  }

  test('une base neuve n’a que position_x / position_y', () => {
    const columns = columnsOf(openDb(':memory:'), 'characters')

    assert.ok(columns.includes('position_x'))
    assert.ok(columns.includes('position_y'))
    for (const gone of ['home_x', 'home_y', 'home_label', 'known_x', 'known_y', 'known_label', 'known_date']) {
      assert.ok(!columns.includes(gone), `${gone} ne doit plus exister`)
    }
  })

  test('la position connue devient la position, la générale est abandonnée', () => {
    const path = join(tempDir, 'position-unique.db')
    const legacy = openLegacyV2(path)
    const withBoth = randomUUID()
    const homeOnly = randomUUID()
    const nowhere = randomUUID()
    legacy
      .prepare(
        'INSERT INTO characters (id, name, home_x, home_y, home_label, known_x, known_y, known_label, known_date)' +
          ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(withBoth, 'Les deux', 10, 20, 'Blancherive', 30, 40, 'Solitude', '2026-07-15')
    legacy
      .prepare('INSERT INTO characters (id, name, home_x, home_y) VALUES (?, ?, ?, ?)')
      .run(homeOnly, 'Domicile seul', 50, 60)
    legacy.prepare('INSERT INTO characters (id, name) VALUES (?, ?)').run(nowhere, 'Sans position')
    legacy.close()

    const db = openDb(path)
    const rows = db
      .prepare('SELECT id, position_x, position_y FROM characters ORDER BY name')
      .all() as { id: string; position_x: number | null; position_y: number | null }[]
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    db.close()

    const byId = new Map(rows.map((row) => [row.id, row]))
    assert.deepEqual(
      { x: byId.get(withBoth)?.position_x, y: byId.get(withBoth)?.position_y },
      { x: 30, y: 40 },
      'la position connue est conservée',
    )
    assert.deepEqual(
      { x: byId.get(homeOnly)?.position_x, y: byId.get(homeOnly)?.position_y },
      { x: null, y: null },
      'le domicile seul n’est pas repris',
    )
    assert.equal(byId.get(nowhere)?.position_x, null)
    assert.equal(rows.length, 3, 'aucune fiche ne disparaît')
    assert.equal(Number(version.value), SCHEMA_VERSION)
  })

  test('les groupes et leurs liaisons survivent à la migration', () => {
    const path = join(tempDir, 'position-unique-groupes.db')
    const legacy = openLegacyV2(path)
    const characterId = randomUUID()
    const groupId = randomUUID()
    legacy.prepare('INSERT INTO characters (id, name) VALUES (?, ?)').run(characterId, 'Lydia')
    legacy.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(groupId, 'Compagnons')
    legacy
      .prepare('INSERT INTO character_groups (character_id, group_id) VALUES (?, ?)')
      .run(characterId, groupId)
    legacy.close()

    const db = openDb(path)
    const links = countRows(db, 'character_groups')
    db.close()

    assert.equal(links, 1)
  })
})

// #83 : les histoires arrivent avec leurs trois tables de liaison. La migration
// ne fait qu'ajouter, rien de l'existant ne bouge.
describe('migration des histoires (#83)', () => {
  // Base au schéma v3 : toutes les migrations sauf celle qu'on teste.
  function openLegacyV3(path: string): DatabaseSync {
    const legacy = new DatabaseSync(path)
    legacy.exec('PRAGMA foreign_keys = ON')
    legacy.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')
    for (const migration of MIGRATIONS.slice(0, 3)) {
      assert.ok(migration !== undefined)
      legacy.exec(migration)
    }
    legacy.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '3')").run()
    return legacy
  }

  test('migre une base v3 : les données survivent et les tables histoires apparaissent', () => {
    const path = join(tempDir, 'histoires.db')
    const legacy = openLegacyV3(path)
    legacy.prepare('INSERT INTO characters (id, name) VALUES (?, ?)').run(randomUUID(), 'Lydia')
    legacy.close()

    const db = openDb(path)
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[]
    ).map((row) => row.name)
    const characters = db.prepare('SELECT name FROM characters').all() as { name: string }[]
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    db.close()

    assert.equal(Number(version.value), SCHEMA_VERSION)
    for (const table of ['stories', 'story_characters', 'story_groups', 'story_pois']) {
      assert.ok(tables.includes(table), `${table} doit exister après migration`)
    }
    assert.deepEqual(
      characters.map((row) => row.name),
      ['Lydia'],
      'les personnages doivent survivre',
    )
  })
})

// #113 : les groupes gagnent des notes longues. La migration ne fait qu'ajouter
// une colonne à défaut vide, l'existant ne bouge pas.
describe('migration des notes de groupe (#113)', () => {
  // Base au schéma v4 : toutes les migrations sauf celle qu'on teste.
  function openLegacyV4(path: string): DatabaseSync {
    const legacy = new DatabaseSync(path)
    legacy.exec('PRAGMA foreign_keys = ON')
    legacy.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')
    for (const migration of MIGRATIONS.slice(0, 4)) {
      assert.ok(migration !== undefined)
      legacy.exec(migration)
    }
    legacy.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '4')").run()
    return legacy
  }

  test('migre une base v4 : la colonne notes apparaît vide et l’existant survit', () => {
    const path = join(tempDir, 'notes-groupe.db')
    const legacy = openLegacyV4(path)
    const groupId = randomUUID()
    legacy
      .prepare('INSERT INTO groups (id, name, color, description) VALUES (?, ?, ?, ?)')
      .run(groupId, 'Compagnons', '#c0392b', 'Guilde de Jorrvaskr')
    legacy.close()

    const db = openDb(path)
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as {
      name: string
      color: string | null
      description: string | null
      notes: string
    }
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    db.close()

    assert.equal(SCHEMA_VERSION, 5)
    assert.equal(Number(version.value), 5)
    assert.equal(group.notes, '', 'la colonne notes doit exister avec un défaut vide')
    assert.equal(group.name, 'Compagnons')
    assert.equal(group.color, '#c0392b')
    assert.equal(group.description, 'Guilde de Jorrvaskr')
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
