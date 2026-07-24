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

  // Mode édition des POI : bascule sur la carte, calibrage et création.
  const poiEditMode = ref(false)
  // { id } = édition d'un POI existant ; { x, y } = création à ces coordonnées ; null = fermée.
  const poiModalTarget = ref<{ id: string } | { x: number; y: number } | null>(null)

  // Toggles d'affichage des pins personnages (CDC §5.1).
  const showHomePins = ref(true)
  const showKnownPins = ref(true)

  // Survol synchronisé liste ↔ carte (CDC §5.2), dans les deux sens.
  const hoveredCharacterId = ref<string | null>(null)

  // Pin cliqué : ouvre la mini-fiche popup (CDC §5.1) et surligne/scrolle la
  // carte correspondante dans la sidebar. `kind` distingue la position
  // (générale/connue) puisqu'un personnage peut avoir un pin à chacune.
  const selectedPin = ref<{ characterId: string; kind: 'home' | 'known' } | null>(null)

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

  function togglePoiEditMode(): void {
    poiEditMode.value = !poiEditMode.value
  }
  function openNewPoi(x: number, y: number): void {
    poiModalTarget.value = { x, y }
  }
  function openEditPoi(id: string): void {
    poiModalTarget.value = { id }
  }
  function closePoiModal(): void {
    poiModalTarget.value = null
  }

  function toggleHomePins(): void {
    showHomePins.value = !showHomePins.value
  }
  function toggleKnownPins(): void {
    showKnownPins.value = !showKnownPins.value
  }

  function setHoveredCharacter(id: string | null): void {
    hoveredCharacterId.value = id
  }

  function selectPin(characterId: string, kind: 'home' | 'known'): void {
    selectedPin.value = { characterId, kind }
  }
  function closeCharacterPopup(): void {
    selectedPin.value = null
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
    poiEditMode,
    poiModalTarget,
    togglePoiEditMode,
    openNewPoi,
    openEditPoi,
    closePoiModal,
    showHomePins,
    showKnownPins,
    toggleHomePins,
    toggleKnownPins,
    hoveredCharacterId,
    setHoveredCharacter,
    selectedPin,
    selectPin,
    closeCharacterPopup,
  }
}

export const useUiStore = defineStore('ui', () => createUiStore())
