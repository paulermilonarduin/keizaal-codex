import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api/singleton.ts'
import type { ApiClient } from '../api/endpoints.ts'
import type { Group, GroupInput } from '../../shared/schemas.ts'

export function createGroupsStore(client: ApiClient) {
  const groups = ref<Group[]>([])

  function setAll(items: Group[]): void {
    groups.value = items
  }

  async function create(input: GroupInput): Promise<Group> {
    const group = await client.groups.create(input)
    groups.value.push(group)
    return group
  }

  async function update(id: string, input: GroupInput): Promise<Group> {
    const group = await client.groups.update(id, input)
    const index = groups.value.findIndex((g) => g.id === id)
    if (index !== -1) groups.value[index] = group
    return group
  }

  async function remove(id: string): Promise<void> {
    await client.groups.remove(id)
    groups.value = groups.value.filter((g) => g.id !== id)
  }

  return { groups, setAll, create, update, remove }
}

export const useGroupsStore = defineStore('groups', () => createGroupsStore(api))
