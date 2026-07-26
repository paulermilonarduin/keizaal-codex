import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../api/singleton.ts'
import type { ApiClient } from '../api/endpoints.ts'

export function createNotesStore(client: ApiClient) {
  const text = ref('')
  // `dirty` = une saisie attend d'être envoyée, `saving` = requête en vol.
  // Les deux alimentent l'indicateur d'état du panneau : avec un debounce, sans
  // retour visuel on ne sait pas si sa frappe est partie.
  const dirty = ref(false)
  const saving = ref(false)

  // Remplit sans marquer de modification : l'arrivée de la valeur initiale
  // n'est pas une saisie, sinon chaque démarrage réécrirait les notes.
  function setInitial(value: string): void {
    text.value = value
    dirty.value = false
    saving.value = false
  }

  function markDirty(): void {
    dirty.value = true
  }

  // Le corps d'une requête `keepalive` est plafonné à 64 Ko par la
  // spécification : au-delà elle échouerait, on retombe donc sur un envoi
  // normal. Une note de cette taille reste très au-dessus de l'usage réel.
  const KEEPALIVE_MAX_BYTES = 60_000

  // `closing` : déclenché depuis beforeunload, où un fetch ordinaire serait
  // annulé par la fermeture de la fenêtre.
  async function save(options: { closing?: boolean } = {}): Promise<void> {
    const keepalive =
      options.closing === true && new Blob([text.value]).size <= KEEPALIVE_MAX_BYTES
    saving.value = true
    try {
      await client.notes.save(text.value, keepalive ? { keepalive: true } : undefined)
      dirty.value = false
    } finally {
      saving.value = false
    }
  }

  return { text, dirty, saving, setInitial, markDirty, save }
}

export const useNotesStore = defineStore('notes', () => createNotesStore(api))
