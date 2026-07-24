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

  // Mode placement (ARCHITECTURE.md §5.5, le flux le plus délicat) : la
  // modale se ferme, la carte passe en curseur croix, un clic la rouvre avec
  // le brouillon du formulaire restauré et la position pré-remplie. `draft`
  // est opaque pour le store (CharacterModal seul connaît sa forme) — il ne
  // fait que transporter la saisie en cours sans la perdre.
  const placement = ref<{ kind: 'home' | 'known'; draft: unknown; modalTarget: string | 'new' } | null>(
    null,
  )
  const placementResult = ref<{
    kind: 'home' | 'known'
    draft: unknown
    position: { x: number; y: number; label?: string }
  } | null>(null)

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
    placementResult.value = null
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

  function startPlacement(kind: 'home' | 'known', draft: unknown): void {
    const modalTarget = characterModalTarget.value
    if (modalTarget === null) return
    placementResult.value = null
    placement.value = { kind, draft, modalTarget }
    characterModalTarget.value = null
  }

  function completePlacement(x: number, y: number, label: string | undefined): void {
    if (placement.value === null) return
    const { kind, draft, modalTarget } = placement.value
    placementResult.value = { kind, draft, position: { x, y, label } }
    characterModalTarget.value = modalTarget
    placement.value = null
  }

  function cancelPlacement(): void {
    if (placement.value === null) return
    characterModalTarget.value = placement.value.modalTarget
    placement.value = null
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
    placement,
    placementResult,
    startPlacement,
    completePlacement,
    cancelPlacement,
  }
}

export const useUiStore = defineStore('ui', () => createUiStore())
