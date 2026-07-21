import type { DatabaseSync } from 'node:sqlite'
import type { Character } from '../../shared/schemas.ts'

type CharacterRow = {
  id: string
  game_id: string | null
  name: string | null
  race: string
  relation: string
  role: string | null
  note: string | null
  avatar: string | null
  home_x: number | null
  home_y: number | null
  home_label: string | null
  known_x: number | null
  known_y: number | null
  known_label: string | null
  known_date: string | null
  created_at: string
  updated_at: string
}

export function findAll(db: DatabaseSync): Character[] {
  const rows = db.prepare('SELECT * FROM characters ORDER BY name, game_id').all() as CharacterRow[]
  return rows.map((row) => toCharacter(row, findGroupIds(db, row.id)))
}

export function findById(db: DatabaseSync, id: string): Character | undefined {
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as
    | CharacterRow
    | undefined
  return row === undefined ? undefined : toCharacter(row, findGroupIds(db, id))
}

// Colonnes communes à insert/update, dans le même ordre que mutableValues().
const MUTABLE_COLUMNS = [
  'game_id',
  'name',
  'race',
  'relation',
  'role',
  'note',
  'home_x',
  'home_y',
  'home_label',
  'known_x',
  'known_y',
  'known_label',
  'known_date',
  'updated_at',
] as const

function mutableValues(character: Character): (string | number | null)[] {
  return [
    character.gameId ?? null,
    character.name ?? null,
    character.race,
    character.relation,
    character.role ?? null,
    character.note ?? null,
    character.homePosition?.x ?? null,
    character.homePosition?.y ?? null,
    character.homePosition?.label ?? null,
    character.knownPosition?.x ?? null,
    character.knownPosition?.y ?? null,
    character.knownPosition?.label ?? null,
    character.knownPosition?.date ?? null,
    character.updatedAt,
  ]
}

export function insert(db: DatabaseSync, character: Character): void {
  const columns = [...MUTABLE_COLUMNS, 'id', 'avatar', 'created_at']
  const placeholders = columns.map(() => '?').join(', ')
  db.prepare(`INSERT INTO characters (${columns.join(', ')}) VALUES (${placeholders})`).run(
    ...mutableValues(character),
    character.id,
    character.avatar ?? null,
    character.createdAt,
  )
}

// L'avatar n'est volontairement pas touché : il vit via l'API avatars (ticket #8).
export function update(db: DatabaseSync, character: Character): void {
  const assignments = MUTABLE_COLUMNS.map((column) => `${column} = ?`).join(', ')
  db.prepare(`UPDATE characters SET ${assignments} WHERE id = ?`).run(
    ...mutableValues(character),
    character.id,
  )
}

export function updateAvatar(db: DatabaseSync, id: string, avatar: string | null): void {
  db.prepare('UPDATE characters SET avatar = ? WHERE id = ?').run(avatar, id)
}

export function remove(db: DatabaseSync, id: string): boolean {
  return db.prepare('DELETE FROM characters WHERE id = ?').run(id).changes > 0
}

export function setGroups(db: DatabaseSync, characterId: string, groupIds: readonly string[]): void {
  db.prepare('DELETE FROM character_groups WHERE character_id = ?').run(characterId)
  const insertLink = db.prepare(
    'INSERT INTO character_groups (character_id, group_id) VALUES (?, ?)',
  )
  for (const groupId of groupIds) {
    insertLink.run(characterId, groupId)
  }
}

function findGroupIds(db: DatabaseSync, characterId: string): string[] {
  const rows = db
    .prepare('SELECT group_id FROM character_groups WHERE character_id = ? ORDER BY rowid')
    .all(characterId) as { group_id: string }[]
  return rows.map((row) => row.group_id)
}

function toCharacter(row: CharacterRow, groups: string[]): Character {
  return {
    id: row.id,
    gameId: row.game_id ?? undefined,
    name: row.name ?? undefined,
    race: row.race as Character['race'],
    relation: row.relation as Character['relation'],
    role: row.role ?? undefined,
    note: row.note ?? undefined,
    avatar: row.avatar ?? undefined,
    groups,
    homePosition:
      row.home_x !== null && row.home_y !== null
        ? { x: row.home_x, y: row.home_y, label: row.home_label ?? undefined }
        : undefined,
    knownPosition:
      row.known_x !== null && row.known_y !== null
        ? {
            x: row.known_x,
            y: row.known_y,
            label: row.known_label ?? undefined,
            date: row.known_date ?? undefined,
          }
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
