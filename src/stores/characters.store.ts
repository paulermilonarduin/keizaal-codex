import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api/singleton.ts'
import type { ApiClient } from '../api/endpoints.ts'
import type { Character, CharacterInput } from '../../shared/schemas.ts'

// Factory pure : testable sans Pinia, en injectant un ApiClient (cf. tests/bootstrap.test.ts).
export function createCharactersStore(client: ApiClient) {
  const characters = ref<Character[]>([])

  function setAll(items: Character[]): void {
    characters.value = items
  }

  async function create(input: CharacterInput): Promise<Character> {
    const character = await client.characters.create(input)
    characters.value.push(character)
    return character
  }

  function replace(character: Character): void {
    const index = characters.value.findIndex((c) => c.id === character.id)
    if (index !== -1) characters.value[index] = character
  }

  async function update(id: string, input: CharacterInput): Promise<Character> {
    const character = await client.characters.update(id, input)
    replace(character)
    return character
  }

  async function remove(id: string): Promise<void> {
    await client.characters.remove(id)
    characters.value = characters.value.filter((c) => c.id !== id)
  }

  // Deuxième temps de l'enregistrement avec photo (cahier des charges §5.3) :
  // la fiche existe déjà, on lui attache l'avatar une fois l'upload terminé.
  async function uploadAvatar(id: string, blob: Blob): Promise<Character> {
    const character = await client.avatars.upload(id, blob)
    replace(character)
    return character
  }

  return { characters, setAll, create, update, remove, uploadAvatar }
}

export const useCharactersStore = defineStore('characters', () => createCharactersStore(api))
