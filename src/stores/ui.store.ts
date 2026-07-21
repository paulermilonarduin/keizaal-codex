import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Race, Relation } from '../../shared/enums.ts'

export function createUiStore() {
  const sidebarCollapsed = ref(false)
  const searchQuery = ref('')
  const raceFilter = ref<Race | null>(null)
  const relationFilter = ref<Relation | null>(null)
  const groupFilter = ref<string | null>(null)

  // Modale personnage : 'new' (création), un id (édition), ou null (fermée).
  const characterModalTarget = ref<string | 'new' | null>(null)
  const groupsModalOpen = ref(false)

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function openNewCharacter(): void {
    characterModalTarget.value = 'new'
  }
  function openEditCharacter(id: string): void {
    characterModalTarget.value = id
  }
  function closeCharacterModal(): void {
    characterModalTarget.value = null
  }
  function openGroupsModal(): void {
    groupsModalOpen.value = true
  }
  function closeGroupsModal(): void {
    groupsModalOpen.value = false
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    searchQuery,
    raceFilter,
    relationFilter,
    groupFilter,
    characterModalTarget,
    groupsModalOpen,
    openNewCharacter,
    openEditCharacter,
    closeCharacterModal,
    openGroupsModal,
    closeGroupsModal,
  }
}

export const useUiStore = defineStore('ui', () => createUiStore())
