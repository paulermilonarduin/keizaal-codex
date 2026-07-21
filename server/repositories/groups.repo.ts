import type { DatabaseSync } from 'node:sqlite'
import type { Group } from '../../shared/schemas.ts'

type GroupRow = {
  id: string
  name: string
  color: string | null
  description: string | null
}

export function findAll(db: DatabaseSync): Group[] {
  const rows = db.prepare('SELECT * FROM groups ORDER BY name').all() as GroupRow[]
  return rows.map(toGroup)
}

export function findById(db: DatabaseSync, id: string): Group | undefined {
  const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as GroupRow | undefined
  return row === undefined ? undefined : toGroup(row)
}

export function insert(db: DatabaseSync, group: Group): void {
  db.prepare('INSERT INTO groups (id, name, color, description) VALUES (?, ?, ?, ?)').run(
    group.id,
    group.name,
    group.color ?? null,
    group.description ?? null,
  )
}

export function update(db: DatabaseSync, group: Group): void {
  db.prepare('UPDATE groups SET name = ?, color = ?, description = ? WHERE id = ?').run(
    group.name,
    group.color ?? null,
    group.description ?? null,
    group.id,
  )
}

export function remove(db: DatabaseSync, id: string): boolean {
  return db.prepare('DELETE FROM groups WHERE id = ?').run(id).changes > 0
}

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    description: row.description ?? undefined,
  }
}
