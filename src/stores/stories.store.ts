import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api/singleton.ts'
import type { ApiClient } from '../api/endpoints.ts'
import type { Story, StoryInput } from '../../shared/schemas.ts'

export function createStoriesStore(client: ApiClient) {
  const stories = ref<Story[]>([])

  function setAll(items: Story[]): void {
    stories.value = items
  }

  async function create(input: StoryInput): Promise<Story> {
    const story = await client.stories.create(input)
    stories.value.push(story)
    return story
  }

  async function update(id: string, input: StoryInput): Promise<Story> {
    const story = await client.stories.update(id, input)
    const index = stories.value.findIndex((s) => s.id === id)
    if (index !== -1) stories.value[index] = story
    return story
  }

  async function remove(id: string): Promise<void> {
    await client.stories.remove(id)
    stories.value = stories.value.filter((s) => s.id !== id)
  }

  // Purge locale après la suppression d'une entité liée (#100) : le serveur a
  // déjà cascadé, on aligne l'état client sans recharger /api/data. Les listes
  // sont mutées en place, l'histoire n'est jamais remplacée dans le tableau
  // (même règle que characters.pruneGroup, pour ne pas casser un brouillon ouvert).
  function prune(key: 'characters' | 'groups' | 'pois', id: string): void {
    for (const story of stories.value) {
      if (story[key].includes(id)) {
        story[key] = story[key].filter((linked) => linked !== id)
      }
    }
  }

  function pruneCharacter(id: string): void {
    prune('characters', id)
  }

  function pruneGroup(id: string): void {
    prune('groups', id)
  }

  function prunePoi(id: string): void {
    prune('pois', id)
  }

  return { stories, setAll, create, update, remove, pruneCharacter, pruneGroup, prunePoi }
}

export const useStoriesStore = defineStore('stories', () => createStoriesStore(api))
