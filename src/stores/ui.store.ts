import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Race, Relation } from '../../shared/enums.ts'

export function createUiStore() {
  const sidebarCollapsed = ref(false)
  const searchQuery = ref('')
  const raceFilter = ref<Race | null>(null)
  const relationFilter = ref<Relation | null>(null)
  const groupFilter = ref<string | null>(null)

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    searchQuery,
    raceFilter,
    relationFilter,
    groupFilter,
  }
}

export const useUiStore = defineStore('ui', () => createUiStore())
