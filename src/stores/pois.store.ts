import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api/singleton.ts'
import type { ApiClient } from '../api/endpoints.ts'
import type { Poi, PoiInput } from '../../shared/schemas.ts'

export function createPoisStore(client: ApiClient) {
  const pois = ref<Poi[]>([])

  function setAll(items: Poi[]): void {
    pois.value = items
  }

  async function create(input: PoiInput): Promise<Poi> {
    const poi = await client.pois.create(input)
    pois.value.push(poi)
    return poi
  }

  async function update(id: string, input: PoiInput): Promise<Poi> {
    const poi = await client.pois.update(id, input)
    const index = pois.value.findIndex((p) => p.id === id)
    if (index !== -1) pois.value[index] = poi
    return poi
  }

  async function remove(id: string): Promise<void> {
    await client.pois.remove(id)
    pois.value = pois.value.filter((p) => p.id !== id)
  }

  return { pois, setAll, create, update, remove }
}

export const usePoisStore = defineStore('pois', () => createPoisStore(api))
