import type { DatabaseSync } from 'node:sqlite'

// Les notes générales tiennent dans la table `meta`, déjà un simple couple
// (key, value) créé par openDb hors du tableau MIGRATIONS : pas de nouvelle
// table, donc pas de migration ni de bump de SCHEMA_VERSION (#72).
const KEY = 'general_notes'

export function read(db: DatabaseSync): string {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(KEY) as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

export function write(db: DatabaseSync, text: string): void {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(KEY, text)
}
