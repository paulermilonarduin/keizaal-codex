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
  // Une seule position par personnage (#80). Renommer les colonnes de la
  // position connue suffit à la conserver ; les colonnes du domicile sont
  // simplement supprimées, donc une fiche qui n'avait que lui se retrouve sans
  // position, à replacer à la main (décision assumée). `label` et `date`
  // disparaissent avec : ni l'un ni l'autre n'était plus saisissable.
  // DROP/RENAME COLUMN natifs : aucun index ni contrainte ne porte sur ces
  // colonnes, pas besoin de reconstruire la table.
  `
  ALTER TABLE characters DROP COLUMN home_x;
  ALTER TABLE characters DROP COLUMN home_y;
  ALTER TABLE characters DROP COLUMN home_label;
  ALTER TABLE characters DROP COLUMN known_label;
  ALTER TABLE characters DROP COLUMN known_date;
  ALTER TABLE characters RENAME COLUMN known_x TO position_x;
  ALTER TABLE characters RENAME COLUMN known_y TO position_y;
  `,
  // Histoires : des notes spécifiques reliées à des personnages, des groupes et
  // des lieux déjà en base (#83). Trois tables de liaison plutôt que des
  // colonnes JSON : les cascades SQL suffisent alors à garantir le critère
  // « supprimer un personnage retire le lien sans supprimer l'histoire », sans
  // une ligne de code applicatif. `date` est nullable (facultative), `notes`
  // vaut '' par défaut : une histoire naît avec son seul titre.
  `
  CREATE TABLE stories (
    id    TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date  TEXT,
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE story_characters (
    story_id     TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, character_id)
  );

  CREATE TABLE story_groups (
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, group_id)
  );

  CREATE TABLE story_pois (
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    poi_id   TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, poi_id)
  );
  `,
  // Notes longues des groupes (#113), distinctes de la description courte. Même
  // forme que stories.notes : NOT NULL à défaut vide, un groupe existant se
  // retrouve donc avec des notes vides, jamais NULL.
  `
  ALTER TABLE groups ADD COLUMN notes TEXT NOT NULL DEFAULT '';
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

