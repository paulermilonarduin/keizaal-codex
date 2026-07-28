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

  return { stories, setAll, create, update, remove }
}

export const useStoriesStore = defineStore('stories', () => createStoriesStore(api))
