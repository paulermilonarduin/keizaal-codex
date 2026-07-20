import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { poiInputSchema } from '../shared/schemas.ts'

// Chaque entrée = une migration ; la version de schéma stockée dans meta est
// le nombre de migrations déjà appliquées.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT,
    description TEXT
  );

  CREATE TABLE characters (
    id         TEXT PRIMARY KEY,
    game_id    TEXT UNIQUE,
    name       TEXT,
    race       TEXT,
    relation   TEXT NOT NULL DEFAULT 'inconnu',
    role       TEXT,
    note       TEXT,
    avatar     TEXT,
    home_x     REAL, home_y REAL, home_label TEXT,
    known_x    REAL, known_y REAL, known_label TEXT, known_date TEXT,
    created_at TEXT,
    updated_at TEXT,
    CHECK (game_id IS NOT NULL OR name IS NOT NULL)
  );

  CREATE TABLE character_groups (
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (character_id, group_id)
  );

  CREATE TABLE pois (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'autre',
    x    REAL NOT NULL,
    y    REAL NOT NULL
  );
  `,
]

export const SCHEMA_VERSION = MIGRATIONS.length

const poisSeedSchema = z.array(poiInputSchema)

export function openDb(path: string, options: { poisSeed?: unknown } = {}): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')

  const fresh = currentVersion(db) === 0
  migrate(db)
  if (fresh && options.poisSeed !== undefined) {
    seedPois(db, poisSeedSchema.parse(options.poisSeed))
  }
  return db
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function currentVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  return row === undefined ? 0 : Number(row.value)
}

function migrate(db: DatabaseSync): void {
  const pending = MIGRATIONS.slice(currentVersion(db))
  if (pending.length === 0) return
  transaction(db, () => {
    for (const migration of pending) {
      db.exec(migration)
    }
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).run(String(SCHEMA_VERSION))
  })
}

function seedPois(db: DatabaseSync, pois: z.infer<typeof poisSeedSchema>): void {
  const insert = db.prepare('INSERT INTO pois (id, name, type, x, y) VALUES (?, ?, ?, ?, ?)')
  transaction(db, () => {
    for (const poi of pois) {
      insert.run(randomUUID(), poi.name, poi.type, poi.x, poi.y)
    }
  })
}
