import type { DatabaseSync } from 'node:sqlite'
import type { Story } from '../../shared/schemas.ts'

type StoryRow = {
  id: string
  title: string
  date: string | null
  notes: string
}

export type StoryLinks = {
  characters: readonly string[]
  groups: readonly string[]
  pois: readonly string[]
}

export function findAll(db: DatabaseSync): Story[] {
  const rows = db.prepare('SELECT * FROM stories ORDER BY title').all() as StoryRow[]
  return rows.map((row) => toStory(row, findLinks(db, row.id)))
}

export function findById(db: DatabaseSync, id: string): Story | undefined {
  const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as StoryRow | undefined
  return row === undefined ? undefined : toStory(row, findLinks(db, id))
}

export function insert(db: DatabaseSync, story: Story): void {
  db.prepare('INSERT INTO stories (id, title, date, notes) VALUES (?, ?, ?, ?)').run(
    story.id,
    story.title,
    story.date ?? null,
    story.notes,
  )
}

export function update(db: DatabaseSync, story: Story): void {
  db.prepare('UPDATE stories SET title = ?, date = ?, notes = ? WHERE id = ?').run(
    story.title,
    story.date ?? null,
    story.notes,
    story.id,
  )
}

export function remove(db: DatabaseSync, id: string): boolean {
  return db.prepare('DELETE FROM stories WHERE id = ?').run(id).changes > 0
}

export function removeAll(db: DatabaseSync): void {
  db.exec('DELETE FROM stories')
}

// Les trois tables de liaison suivent le patron de setGroups (characters.repo) :
// on efface puis on réinsère, la contrainte FK est l'autorité sur l'existence
// des entités liées.
export function setLinks(db: DatabaseSync, storyId: string, links: StoryLinks): void {
  replaceLinks(db, 'story_characters', 'character_id', storyId, links.characters)
  replaceLinks(db, 'story_groups', 'group_id', storyId, links.groups)
  replaceLinks(db, 'story_pois', 'poi_id', storyId, links.pois)
}

function replaceLinks(
  db: DatabaseSync,
  table: string,
  column: string,
  storyId: string,
  ids: readonly string[],
): void {
  db.prepare(`DELETE FROM ${table} WHERE story_id = ?`).run(storyId)
  const insertLink = db.prepare(`INSERT INTO ${table} (story_id, ${column}) VALUES (?, ?)`)
  for (const id of ids) {
    insertLink.run(storyId, id)
  }
}

// Trois requêtes par histoire (N+1 assumé, comme les groupes d'un personnage) :
// le volume est celui d'un carnet personnel, la lisibilité prime.
function findLinks(db: DatabaseSync, storyId: string): StoryLinks {
  return {
    characters: findLinkIds(db, 'story_characters', 'character_id', storyId),
    groups: findLinkIds(db, 'story_groups', 'group_id', storyId),
    pois: findLinkIds(db, 'story_pois', 'poi_id', storyId),
  }
}

function findLinkIds(
  db: DatabaseSync,
  table: string,
  column: string,
  storyId: string,
): string[] {
  const rows = db
    .prepare(`SELECT ${column} AS linked_id FROM ${table} WHERE story_id = ? ORDER BY rowid`)
    .all(storyId) as { linked_id: string }[]
  return rows.map((row) => row.linked_id)
}

function toStory(row: StoryRow, links: StoryLinks): Story {
  return {
    id: row.id,
    title: row.title,
    // null SQL → undefined TS : le schéma partagé rend la date facultative.
    date: row.date ?? undefined,
    notes: row.notes,
    characters: [...links.characters],
    groups: [...links.groups],
    pois: [...links.pois],
  }
}
