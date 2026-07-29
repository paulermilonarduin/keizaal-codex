import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  transferBundleSchema,
  type Character,
  type Story,
  type TransferBundle,
} from '../../shared/schemas.ts'
import { transaction } from '../db.ts'

// Groups et POI partagent la même forme de repo (findById/insert/update) :
// l'upsert générique remplace les deux fonctions dédiées auparavant dupliquées.
type UpsertableRepo<T> = {
  findById: (db: DatabaseSync, id: string) => T | undefined
  insert: (db: DatabaseSync, item: T) => void
  update: (db: DatabaseSync, item: T) => void
}

function upsert<T extends { id: string }>(db: DatabaseSync, repo: UpsertableRepo<T>, item: T): void {
  if (repo.findById(db, item.id) === undefined) repo.insert(db, item)
  else repo.update(db, item)
}

type CharactersRepo = typeof import('../repositories/characters.repo.ts')
type GroupsRepo = typeof import('../repositories/groups.repo.ts')
type PoisRepo = typeof import('../repositories/pois.repo.ts')
type NotesRepo = typeof import('../repositories/notes.repo.ts')
type StoriesRepo = typeof import('../repositories/stories.repo.ts')
type Deps = {
  db: DatabaseSync
  charactersRepo: CharactersRepo
  groupsRepo: GroupsRepo
  poisRepo: PoisRepo
  notesRepo: NotesRepo
  storiesRepo: StoriesRepo
  avatarsDir?: string
}

export function createTransferService({
  db,
  charactersRepo,
  groupsRepo,
  poisRepo,
  notesRepo,
  storiesRepo,
  avatarsDir = 'data/avatars',
}: Deps) {
  async function exportBundle(): Promise<TransferBundle> {
    const characters = charactersRepo.findAll(db)
    const avatars: Record<string, string> = {}
    for (const character of characters) {
      if (character.avatar === undefined) continue
      const filename = character.avatar.split('/').pop() ?? character.avatar
      try {
        const bytes = await readFile(join(avatarsDir, filename))
        avatars[filename] = bytes.toString('base64')
      } catch {
        // Fichier avatar manquant sur disque : on exporte quand même le reste
        // (état dégradé mais cohérent, cf. règle d'upload du ticket #8).
      }
    }
    return {
      exportedAt: new Date().toISOString(),
      characters,
      groups: groupsRepo.findAll(db),
      pois: poisRepo.findAll(db),
      avatars,
      notes: notesRepo.read(db),
      stories: storiesRepo.findAll(db),
    }
  }

  // Correspondance gameId puis id interne (cahier des charges §5.4) ; sans
  // correspondance, la fiche est créée avec son id d'origine. Renvoie l'id
  // finalement retenu : les liens d'histoires du bundle doivent le suivre (#83).
  function mergeCharacter(imported: Character): string {
    const existing =
      (imported.gameId !== undefined
        ? charactersRepo.findByGameId(db, imported.gameId)
        : undefined) ?? charactersRepo.findById(db, imported.id)

    const finalId = existing?.id ?? imported.id
    const avatar = imported.avatar ?? existing?.avatar
    const character: Character = { ...imported, id: finalId, avatar }

    if (existing === undefined) {
      charactersRepo.insert(db, character)
    } else {
      // update() ne touche jamais la colonne avatar (ticket #8) : on la fixe
      // explicitement pour préserver l'avatar existant si l'import n'en a pas.
      charactersRepo.update(db, character)
      // Timestamp du bundle, pas un timestamp frais : updateAvatar écrit aussi
      // updated_at (#108) et l'import doit préserver les dates importées.
      charactersRepo.updateAvatar(db, finalId, avatar ?? null, character.updatedAt)
    }
    charactersRepo.setGroups(db, finalId, imported.groups)
    return finalId
  }

  // Une histoire du bundle référence les ids du fichier ; en merge, un
  // personnage rapproché par gameId garde son id local. Sans ce remap, le lien
  // viserait un id absent de la base et la contrainte FK ferait échouer tout
  // l'import (#83).
  function importStory(story: Story, characterIds: Map<string, string>): void {
    const characters = story.characters.map((id) => characterIds.get(id) ?? id)
    upsert(db, storiesRepo, { ...story, characters })
    storiesRepo.setLinks(db, story.id, { characters, groups: story.groups, pois: story.pois })
  }

  async function writeAvatarFiles(avatars: Record<string, string>): Promise<void> {
    await mkdir(avatarsDir, { recursive: true })
    for (const [filename, base64] of Object.entries(avatars)) {
      await writeFile(join(avatarsDir, filename), Buffer.from(base64, 'base64'))
    }
  }

  return {
    exportBundle,

    async importBundle(input: unknown, mode: 'replace' | 'merge'): Promise<void> {
      const bundle = transferBundleSchema.parse(input)

      // Transaction SQLite unique : soit tout passe, soit rien.
      transaction(db, () => {
        if (mode === 'replace') {
          charactersRepo.removeAll(db)
          groupsRepo.removeAll(db)
          poisRepo.removeAll(db)
          storiesRepo.removeAll(db)
          for (const group of bundle.groups) groupsRepo.insert(db, group)
          for (const character of bundle.characters) {
            charactersRepo.insert(db, character)
            charactersRepo.setGroups(db, character.id, character.groups)
          }
          for (const poi of bundle.pois) poisRepo.insert(db, poi)
          // En dernier : les histoires référencent les trois collections
          // ci-dessus, qui doivent déjà être en base.
          for (const story of bundle.stories) importStory(story, new Map())
          notesRepo.write(db, bundle.notes)
        } else {
          for (const group of bundle.groups) upsert(db, groupsRepo, group)
          for (const poi of bundle.pois) upsert(db, poisRepo, poi)
          const characterIds = new Map<string, string>()
          for (const character of bundle.characters) {
            characterIds.set(character.id, mergeCharacter(character))
          }
          for (const story of bundle.stories) importStory(story, characterIds)
          // Le merge ajoute des fiches, il n'écrase pas une note rédigée
          // localement — on ne l'adopte que si l'on n'en a aucune (#72).
          if (notesRepo.read(db) === '') notesRepo.write(db, bundle.notes)
        }
      })

      // Le système de fichiers n'est pas transactionnel : les avatars ne
      // sont écrits qu'après un commit réussi (base d'abord, fichiers
      // ensuite, même règle que l'upload du ticket #8).
      if (mode === 'replace') await rm(avatarsDir, { recursive: true, force: true })
      await writeAvatarFiles(bundle.avatars)
    },
  }
}

export type TransferService = ReturnType<typeof createTransferService>
