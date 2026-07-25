import { DatabaseSync } from 'node:sqlite'

// Chaque entrée = une migration ; la version de schéma stockée dans meta est
// le nombre de migrations déjà appliquées.
export const MIGRATIONS: readonly string[] = [
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
  // Fin du seeding : chacun crée ses propres lieux, on repart d'une table
  // vide (#50). Les personnages et groupes ne sont pas touchés.
  // Au passage, le DEFAULT 'autre' de pois.type était un vestige : ce type
  // n'existe plus dans POI_TYPES, le défaut applicatif est 'landmark'.
  `
  DELETE FROM pois;
  ALTER TABLE pois RENAME TO pois_old;
  CREATE TABLE pois (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'landmark',
    x    REAL NOT NULL,
    y    REAL NOT NULL
  );
  DROP TABLE pois_old;
  `,
]

export const SCHEMA_VERSION = MIGRATIONS.length

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')

  migrate(db)
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

