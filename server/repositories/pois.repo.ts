import type { DatabaseSync } from 'node:sqlite'
import type { Poi } from '../../shared/schemas.ts'

type PoiRow = { id: string; name: string; type: string; x: number; y: number }

export function findAll(db: DatabaseSync): Poi[] {
  const rows = db.prepare('SELECT * FROM pois ORDER BY name').all() as PoiRow[]
  return rows.map(toPoi)
}

export function findById(db: DatabaseSync, id: string): Poi | undefined {
  const row = db.prepare('SELECT * FROM pois WHERE id = ?').get(id) as PoiRow | undefined
  return row === undefined ? undefined : toPoi(row)
}

export function insert(db: DatabaseSync, poi: Poi): void {
  db.prepare('INSERT INTO pois (id, name, type, x, y) VALUES (?, ?, ?, ?, ?)').run(
    poi.id,
    poi.name,
    poi.type,
    poi.x,
    poi.y,
  )
}

export function update(db: DatabaseSync, poi: Poi): void {
  db.prepare('UPDATE pois SET name = ?, type = ?, x = ?, y = ? WHERE id = ?').run(
    poi.name,
    poi.type,
    poi.x,
    poi.y,
    poi.id,
  )
}

export function remove(db: DatabaseSync, id: string): boolean {
  return db.prepare('DELETE FROM pois WHERE id = ?').run(id).changes > 0
}

export function removeAll(db: DatabaseSync): void {
  db.exec('DELETE FROM pois')
}

function toPoi(row: PoiRow): Poi {
  return { id: row.id, name: row.name, type: row.type as Poi['type'], x: row.x, y: row.y }
}
