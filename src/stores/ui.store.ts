import { ref } from 'vue'
import { defineStore } from 'pinia'

export function createUiStore() {
  const sidebarCollapsed = ref(false)

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { sidebarCollapsed, toggleSidebar }
}

export const useUiStore = defineStore('ui', () => createUiStore())
