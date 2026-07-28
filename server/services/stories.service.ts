import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { storyInputSchema, type Story } from '../../shared/schemas.ts'
import { transaction } from '../db.ts'
import { ValidationError } from '../lib/errors.ts'
import { requireFound } from '../lib/require.ts'

type StoriesRepo = typeof import('../repositories/stories.repo.ts')
type Deps = { db: DatabaseSync; storiesRepo: StoriesRepo }

export function createStoriesService({ db, storiesRepo }: Deps) {
  function requireStory(id: string): Story {
    return requireFound(storiesRepo.findById(db, id), 'Histoire introuvable')
  }

  // Écritures histoire + liaisons dans une transaction unique (patron de
  // characters.service) : un lien vers un id inexistant ne doit pas laisser une
  // histoire à moitié écrite derrière lui.
  function writeWithLinks(story: Story, write: () => void): Story {
    try {
      return transaction(db, () => {
        write()
        storiesRepo.setLinks(db, story.id, story)
        return requireStory(story.id)
      })
    } catch (error) {
      throw translateConstraintError(error)
    }
  }

  return {
    list(): Story[] {
      return storiesRepo.findAll(db)
    },

    get(id: string): Story {
      return requireStory(id)
    },

    create(input: unknown): Story {
      const data = storyInputSchema.parse(input)
      const story: Story = { ...data, id: randomUUID() }
      return writeWithLinks(story, () => storiesRepo.insert(db, story))
    },

    update(id: string, input: unknown): Story {
      requireStory(id)
      const data = storyInputSchema.parse(input)
      const story: Story = { ...data, id }
      return writeWithLinks(story, () => storiesRepo.update(db, story))
    },

    remove(id: string): void {
      requireStory(id)
      storiesRepo.remove(db, id)
    },
  }
}

export type StoriesService = ReturnType<typeof createStoriesService>

function translateConstraintError(error: unknown): unknown {
  if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
    return new ValidationError('Un des éléments liés n’existe pas')
  }
  return error
}
