import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Race, Relation, PoiType } from '../../shared/enums.ts'
import type { SidebarTab } from '../lib/sidebarTabs.ts'
import type { PlacementRestore } from '../lib/characterDraft.ts'

export function createUiStore() {
  // Onglet actif de la sidebar (#52). Personnages par défaut : l'usage principal.
  const activeTab = ref<SidebarTab>('characters')

  // Une recherche par onglet, jamais réinitialisée en changeant d'onglet : on
  // retrouve son filtre en revenant. `raceFilter`/`relationFilter`/`groupFilter`
  // n'existent que pour les personnages, leur nom reste sans ambiguïté.
  const characterSearch = ref('')
  const raceFilter = ref<Race | null>(null)
  const relationFilter = ref<Relation | null>(null)
  const groupFilter = ref<string | null>(null)
  const groupSearch = ref('')
  const poiSearch = ref('')
  const poiTypeFilter = ref<PoiType | null>(null)
  const storySearch = ref('')

  // Modale personnage : 'new' (création), un id (édition), ou null (fermée).
  const characterModalTarget = ref<string | 'new' | null>(null)
  const groupsModalOpen = ref(false)
  // Même convention pour la modale histoire (#83) : la création n'y demande que
  // le titre et la date, l'édition ouvre les deux colonnes.
  const storyModalTarget = ref<string | 'new' | null>(null)

  // Mode édition des POI : bascule sur la carte, calibrage et création.
  const poiEditMode = ref(false)
  // Mode édition des personnages (#88) : les pins deviennent déplaçables au
  // glisser-déposer. Exclusif du mode POI, cf. toggleCharacterEditMode.
  const characterEditMode = ref(false)
  // Mode déplacement des POI (#99) : les repères deviennent déplaçables au
  // glisser-déposer. Séparé du mode édition POI, qui garde la création au clic
  // et la modale, et exclusif des deux autres modes de carte.
  const poiMoveMode = ref(false)
  // { id } = édition d'un POI existant ; { x, y } = création à ces coordonnées ; null = fermée.
  const poiModalTarget = ref<{ id: string } | { x: number; y: number } | null>(null)

  // Affichage des pins personnages (CDC §5.1). Un seul toggle depuis #80 :
  // un personnage n'a plus qu'une position, donc qu'un pin.
  const showPins = ref(true)

  // Survol synchronisé liste ↔ carte (CDC §5.2), dans les deux sens.
  const hoveredCharacterId = ref<string | null>(null)
  // Même mécanisme pour les POI (#54), indépendant : survoler une carte POI ne
  // doit pas éteindre le surlignage d'un personnage.
  const hoveredPoiId = ref<string | null>(null)

  // Pin cliqué : ouvre la mini-fiche popup (CDC §5.1) et surligne/scrolle la
  // carte correspondante dans la sidebar. Un personnage = un pin depuis #80,
  // son id suffit donc à désigner le pin sélectionné.
  const selectedCharacterId = ref<string | null>(null)

  // Mode placement (ARCHITECTURE.md §5.5, le flux le plus délicat) : la
  // modale se ferme, la carte passe en curseur croix, un clic la rouvre avec
  // le brouillon du formulaire restauré et la position pré-remplie. `draft`
  // est opaque pour le store (CharacterModal seul connaît sa forme) — il ne
  // fait que transporter la saisie en cours sans la perdre.
  const placement = ref<{ draft: unknown; modalTarget: string | 'new' } | null>(null)
  // `update` absent = retour d'un cancel (brouillon inchangé, juste restauré) ;
  // présent = retour d'un clic carte (position posée en plus, CDC §5.1).
  const placementResult = ref<PlacementRestore | null>(null)

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

  function openNewStory(): void {
    storyModalTarget.value = 'new'
  }
  function openEditStory(id: string): void {
    storyModalTarget.value = id
  }
  function closeStoryModal(): void {
    storyModalTarget.value = null
  }

  function togglePoiEditMode(): void {
    poiEditMode.value = !poiEditMode.value
    // Les deux modes d'édition sont exclusifs (#88) : sur la carte, un clic qui
    // crée un POI et des pins déplaçables ne cohabitent pas sans ambiguïté.
    if (poiEditMode.value) {
      characterEditMode.value = false
      // Le déplacement des POI aussi (#99) : dans ce mode le clic ouvre la
      // modale, il ne peut pas en même temps amorcer un glisser-déposer.
      poiMoveMode.value = false
    }
  }

  // Le mode ne touche pas à la mini-fiche personnage, contrairement à #88 : un
  // POI qui bouge ne déplace aucun pin, la fiche ouverte reste donc valide.
  function togglePoiMoveMode(): void {
    poiMoveMode.value = !poiMoveMode.value
    if (poiMoveMode.value) {
      poiEditMode.value = false
      characterEditMode.value = false
    }
  }

  function toggleCharacterEditMode(): void {
    characterEditMode.value = !characterEditMode.value
    if (characterEditMode.value) {
      poiEditMode.value = false
      poiMoveMode.value = false
      // La mini-fiche est ancrée à la position du pin : après un déplacement
      // elle resterait plantée sur l'ancienne. En mode édition le clic ne
      // l'ouvre plus, celle déjà ouverte se ferme donc ici.
      selectedCharacterId.value = null
    }
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

  function togglePins(): void {
    showPins.value = !showPins.value
  }

  function setHoveredCharacter(id: string | null): void {
    hoveredCharacterId.value = id
  }

  function setHoveredPoi(id: string | null): void {
    hoveredPoiId.value = id
  }

  function setActiveTab(tab: SidebarTab): void {
    activeTab.value = tab
  }

  function selectPin(characterId: string): void {
    selectedCharacterId.value = characterId
    // Le clic sur un pin surligne et scrolle la carte du personnage dans la
    // liste (CDC §5.1) : sans revenir sur l'onglet Personnages, cette liste est
    // démontée et l'effet serait invisible.
    activeTab.value = 'characters'
  }
  function closeCharacterPopup(): void {
    selectedCharacterId.value = null
  }

  function startPlacement(draft: unknown): void {
    const modalTarget = characterModalTarget.value
    if (modalTarget === null) return
    placementResult.value = null
    placement.value = { draft, modalTarget }
    characterModalTarget.value = null
  }

  // Plus de libellé : il reprenait le nom du POI le plus proche, sans rayon
  // maximum, donc un pin posé à Solitude héritait du seul POI existant (#78).
  // Le champ a fini par disparaître du schéma (#80), une position n'est plus
  // que des coordonnées.
  function completePlacement(x: number, y: number): void {
    if (placement.value === null) return
    const { draft, modalTarget } = placement.value
    placementResult.value = { draft, update: { position: { x, y } } }
    characterModalTarget.value = modalTarget
    placement.value = null
  }

  function cancelPlacement(): void {
    if (placement.value === null) return
    const { draft, modalTarget } = placement.value
    placementResult.value = { draft }
    characterModalTarget.value = modalTarget
    placement.value = null
  }

  return {
    activeTab,
    setActiveTab,
    characterSearch,
    raceFilter,
    relationFilter,
    groupFilter,
    groupSearch,
    poiSearch,
    poiTypeFilter,
    storySearch,
    characterModalTarget,
    groupsModalOpen,
    storyModalTarget,
    openNewCharacter,
    openEditCharacter,
    closeCharacterModal,
    openGroupsModal,
    closeGroupsModal,
    openNewStory,
    openEditStory,
    closeStoryModal,
    poiEditMode,
    poiModalTarget,
    togglePoiEditMode,
    characterEditMode,
    toggleCharacterEditMode,
    poiMoveMode,
    togglePoiMoveMode,
    openNewPoi,
    openEditPoi,
    closePoiModal,
    showPins,
    togglePins,
    hoveredCharacterId,
    setHoveredCharacter,
    hoveredPoiId,
    setHoveredPoi,
    selectedCharacterId,
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
