<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { api } from './api/singleton.ts'
import { useCharactersStore } from './stores/characters.store.ts'
import { useGroupsStore } from './stores/groups.store.ts'
import { usePoisStore } from './stores/pois.store.ts'
import { useNotesStore } from './stores/notes.store.ts'
import { useStoriesStore } from './stores/stories.store.ts'
import { useUiStore } from './stores/ui.store.ts'
import { loadInitialData } from './stores/bootstrap.ts'
import { exportFilename } from './lib/exportFilename.ts'
import { describeError } from './lib/describeError.ts'
import { checkForUpdates, type ReleaseInfo } from './lib/updateCheck.ts'
import { movedCharacterInput } from './lib/characterInput.ts'
import type {
  CharacterInput,
  GroupInput,
  Poi,
  PoiInput,
  Story,
  StoryInput,
  TransferBundle,
} from '../shared/schemas.ts'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import ToolbarButton from './components/layout/ToolbarButton.vue'
import CharactersPanel from './components/sidebar/CharactersPanel.vue'
import CharacterModal from './components/modals/CharacterModal.vue'
import GroupModal from './components/modals/GroupModal.vue'
import GroupsPanel from './components/sidebar/GroupsPanel.vue'
import PoisPanel from './components/sidebar/PoisPanel.vue'
import StoriesPanel from './components/sidebar/StoriesPanel.vue'
import StoryModal from './components/modals/StoryModal.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import UpdateModal from './components/modals/UpdateModal.vue'
import MapView from './components/map/MapView.vue'
import NotesPanel from './components/notes/NotesPanel.vue'
import PoiEditModal from './components/map/PoiEditModal.vue'
import TransferButtons from './components/transfer/TransferButtons.vue'

const SKYRIM_MAP = { url: '/map/skyrim.jpg', width: 2048, height: 1536 }
// Liaison locale : la globale injectée par vite.config.ts n'est pas résolue
// telle quelle dans le <template> (le compilateur la traiterait comme une
// propriété de _ctx, cf. #42).
const appVersion = __APP_VERSION__

const characters = useCharactersStore()
const groups = useGroupsStore()
const pois = usePoisStore()
const notes = useNotesStore()
const stories = useStoriesStore()
const ui = useUiStore()

// Référence au panneau de notes : uniquement pour annuler une écriture en
// attente avant un import (cf. handleImport).
const notesPanel = useTemplateRef<{ cancelPendingSave: () => void }>('notesPanel')

// Mise à jour (#94) : l'état vit ici, comme actionError. Aucune persistance du
// « vu » (décision de Paul) : tant qu'on n'est pas à jour, le badge revient à
// chaque lancement.
const updateReleases = ref<ReleaseInfo[]>([])
const updateCheckState = ref<'idle' | 'checking' | 'upToDate'>('idle')
const updateModalOpen = ref(false)
let upToDateTimer: ReturnType<typeof setTimeout> | null = null

async function runUpdateCheck(): Promise<void> {
  if (upToDateTimer !== null) clearTimeout(upToDateTimer)
  updateCheckState.value = 'checking'
  const releases = await checkForUpdates(appVersion)
  // null = échec silencieux (hors ligne, rate limit) : jamais de bandeau, la
  // vérification est un bonus (critère d'acceptation de #94).
  if (releases === null) {
    updateCheckState.value = 'idle'
    return
  }
  updateReleases.value = releases
  if (releases.length > 0) {
    updateCheckState.value = 'idle'
    return
  }
  // « à jour » est un retour au clic sur la version : la mention s'efface
  // d'elle-même pour ne pas encombrer le header en permanence.
  updateCheckState.value = 'upToDate'
  upToDateTimer = setTimeout(() => {
    updateCheckState.value = 'idle'
    upToDateTimer = null
  }, 2500)
}

onMounted(() => {
  void loadInitialData(api, { characters, groups, pois, notes, stories })
  // Sans await : le codex s'affiche sans attendre GitHub.
  void runUpdateCheck()
})

// Le sous-titre du header suit l'onglet actif : il commente la section affichée.
const subtitle = computed(() => {
  if (ui.activeTab === 'groups') return `${groups.groups.length} groupe(s)`
  if (ui.activeTab === 'pois') return `${pois.pois.length} point(s) d'intérêt`
  if (ui.activeTab === 'stories') return `${stories.stories.length} histoire(s)`
  return `${characters.characters.length} personnage(s) suivi(s)`
})

const editingCharacter = computed(() => {
  const target = ui.characterModalTarget
  if (target === null || target === 'new') return null
  return characters.characters.find((character) => character.id === target) ?? null
})

// Erreur d'action affichée en bandeau (CDC/backlog #18) : toute requête API
// déclenchée depuis l'UI qui échoue (conflit, validation...) doit rester
// visible plutôt que de se perdre dans la console.
const actionError = ref<string | null>(null)

async function handleSaveCharacter(payload: {
  input: CharacterInput
  avatarBlob: Blob | null
  removeAvatar: boolean
}): Promise<void> {
  try {
    const target = ui.characterModalTarget
    const saved =
      target !== null && target !== 'new'
        ? await characters.update(target, payload.input)
        : await characters.create(payload.input)
    // Une image choisie l'emporte : la modale ne peut pas demander les deux à la
    // fois, mais l'ordre rend l'intention explicite (#118).
    if (payload.avatarBlob !== null) {
      await characters.uploadAvatar(saved.id, payload.avatarBlob)
    } else if (payload.removeAvatar) {
      await characters.removeAvatar(saved.id)
    }
    ui.closeCharacterModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleDeleteCharacter(id: string): Promise<void> {
  try {
    await characters.remove(id)
    // Le serveur cascade, les stores déjà chargés gardent l'id mort : sans cette
    // purge le prochain PUT complet le renverrait et se ferait rejeter (#100).
    stories.pruneCharacter(id)
    ui.closeCharacterModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

const editingGroup = computed(() => {
  const target = ui.groupModalTarget
  if (target === null || target === 'new') return null
  return groups.groups.find((group) => group.id === target) ?? null
})

// Création depuis la modale de sélection des groupes de la fiche personnage
// (#114) : la sélection reste ouverte, on ne bascule nulle part, et la gestion
// d'erreur reste ici (ARCHITECTURE.md §5.3).
async function handleCreateGroup(input: GroupInput): Promise<void> {
  try {
    await groups.create(input)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

// Création depuis la modale dédiée (#113) : elle ne demande que le nom et la
// couleur, puis bascule en édition, où la description et les notes deviennent
// possibles (même enchaînement que les histoires).
async function handleCreateGroupAndEdit(input: GroupInput): Promise<void> {
  try {
    const created = await groups.create(input)
    ui.openEditGroup(created.id)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleUpdateGroupFromModal(input: GroupInput): Promise<void> {
  const target = ui.groupModalTarget
  if (target === null || target === 'new') return
  try {
    await groups.update(target, input)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

// Renvoie true quand la suppression a abouti : la modale ne se referme que dans
// ce cas, une erreur doit rester visible avec la fiche sous les yeux.
async function handleRemoveGroup(id: string): Promise<boolean> {
  try {
    await groups.remove(id)
    characters.pruneGroup(id)
    stories.pruneGroup(id)
    return true
  } catch (error) {
    actionError.value = describeError(error)
    return false
  }
}

// Pas de chemin parallèle : la purge des ids morts dans les stores (#100) doit
// jouer aussi depuis la modale.
async function handleDeleteGroupFromModal(id: string): Promise<void> {
  if (await handleRemoveGroup(id)) ui.closeGroupModal()
}

const editingPoi = computed(() => {
  const target = ui.poiModalTarget
  if (target === null || !('id' in target)) return null
  return pois.pois.find((poi) => poi.id === target.id) ?? null
})

const poiModalCoords = computed(() => {
  const target = ui.poiModalTarget
  if (target === null) return { x: 0, y: 0 }
  if ('id' in target) return { x: editingPoi.value?.x ?? 0, y: editingPoi.value?.y ?? 0 }
  return { x: target.x, y: target.y }
})

async function handleSavePoi(input: PoiInput): Promise<void> {
  try {
    const poi = editingPoi.value
    if (poi !== null) await pois.update(poi.id, input)
    else await pois.create(input)
    ui.closePoiModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleDeletePoi(id: string): Promise<void> {
  try {
    await pois.remove(id)
    stories.prunePoi(id)
    ui.closePoiModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

// Suppression depuis la liste (#54) : la modale POI a sa propre confirmation,
// l'onglet a besoin de la sienne.
const poiPendingDelete = ref<Poi | null>(null)

function askRemovePoi(id: string): void {
  poiPendingDelete.value = pois.pois.find((poi) => poi.id === id) ?? null
}

async function confirmRemovePoi(): Promise<void> {
  const poi = poiPendingDelete.value
  poiPendingDelete.value = null
  if (poi === null) return
  // Le marqueur disparaît : sans ça un survol résiduel forcerait l'affichage
  // d'un POI qui n'existe plus.
  if (ui.hoveredPoiId === poi.id) ui.setHoveredPoi(null)
  try {
    await pois.remove(poi.id)
    stories.prunePoi(poi.id)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

function handleCenterPoi(id: string): void {
  const poi = pois.pois.find((p) => p.id === id)
  if (poi === undefined) return
  centerOnPosition(poi.x, poi.y)
}

async function handlePoiMoved(payload: { id: string; x: number; y: number }): Promise<void> {
  const poi = pois.pois.find((p) => p.id === payload.id)
  if (poi === undefined) return
  try {
    await pois.update(poi.id, { name: poi.name, type: poi.type, x: payload.x, y: payload.y })
  } catch (error) {
    actionError.value = describeError(error)
  }
}

const editingStory = computed(() => {
  const target = ui.storyModalTarget
  if (target === null || target === 'new') return null
  return stories.stories.find((story) => story.id === target) ?? null
})

// La création ne demande que le titre et la date : une fois la fiche en base,
// la modale bascule en édition, où les liens et les notes deviennent
// possibles (#83).
async function handleCreateStory(input: StoryInput): Promise<void> {
  try {
    const created = await stories.create(input)
    ui.openEditStory(created.id)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleUpdateStory(input: StoryInput): Promise<void> {
  const target = ui.storyModalTarget
  if (target === null || target === 'new') return
  try {
    await stories.update(target, input)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleDeleteStory(id: string): Promise<void> {
  try {
    await stories.remove(id)
    ui.closeStoryModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

// Suppression depuis la liste : la modale a sa propre confirmation, l'onglet a
// besoin de la sienne (même partage que les POI).
const storyPendingDelete = ref<Story | null>(null)

function askRemoveStory(id: string): void {
  storyPendingDelete.value = stories.stories.find((story) => story.id === id) ?? null
}

async function confirmRemoveStory(): Promise<void> {
  const story = storyPendingDelete.value
  storyPendingDelete.value = null
  if (story === null) return
  try {
    await stories.remove(story.id)
  } catch (error) {
    actionError.value = describeError(error)
  }
}

function handleMapClick(point: { x: number; y: number }): void {
  if (ui.placement !== null) {
    ui.completePlacement(point.x, point.y)
    return
  }
  ui.openNewPoi(point.x, point.y)
}

function handleStartPlacement(draft: unknown): void {
  ui.startPlacement(draft)
}

// Référence à la carte : le centrage est un ordre ponctuel, passé
// impérativement. En prop observée, le cycle réactif de Vue annulait
// l'animation de déplacement (#15, #87).
const mapView = useTemplateRef<{ centerOn: (x: number, y: number) => void }>('mapView')

function centerOnPosition(x: number, y: number): void {
  mapView.value?.centerOn(x, y)
}

function handleCenterCharacter(id: string): void {
  const position = characters.characters.find((c) => c.id === id)?.position
  if (position !== undefined) centerOnPosition(position.x, position.y)
}

// Pin déposé en mode édition (#88) : seule la position change, le reste de la
// fiche est repris tel quel puisque l'update remplace tout.
async function handleCharacterMoved(payload: { id: string; x: number; y: number }): Promise<void> {
  const character = characters.characters.find((c) => c.id === payload.id)
  if (character === undefined) return
  try {
    await characters.update(
      character.id,
      movedCharacterInput(character, { x: payload.x, y: payload.y }),
    )
  } catch (error) {
    actionError.value = describeError(error)
  }
}

function handleUnhoverCharacter(id: string): void {
  if (ui.hoveredCharacterId === id) ui.setHoveredCharacter(null)
}

function handleOpenCharacterFromPopup(id: string): void {
  ui.closeCharacterPopup()
  ui.openEditCharacter(id)
}

// Scroll la carte du personnage sélectionné (clic sur un pin) dans la liste,
// même si elle est hors du champ visible de la sidebar (CDC §5.1).
const cardEls = new Map<string, HTMLElement>()
function setCardRef(id: string, el: unknown): void {
  const element = (el as { $el?: unknown } | null)?.$el
  if (element instanceof HTMLElement) cardEls.set(id, element)
  else cardEls.delete(id)
}
watch(
  () => ui.selectedCharacterId,
  (id) => {
    if (id === null) return
    cardEls.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)

const importError = ref<string | null>(null)

async function handleExport(): Promise<void> {
  const bundle = await api.transfer.export()
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFilename(bundle.exportedAt)
  link.click()
  URL.revokeObjectURL(url)
}

async function handleImport(payload: {
  bundle: TransferBundle
  mode: 'replace' | 'merge'
}): Promise<void> {
  importError.value = null
  // Une écriture de notes en attente arriverait après l'import et écraserait
  // les notes importées : on l'abandonne avant de remplacer l'état (#72).
  notesPanel.value?.cancelPendingSave()
  try {
    await api.transfer.import(payload.bundle, payload.mode)
    await loadInitialData(api, { characters, groups, pois, notes, stories })
  } catch (error) {
    importError.value = describeError(error, 'Import invalide.')
  }
}
</script>

<template>
  <main class="app">
    <SidebarPanel
      :version="appVersion"
      :active-tab="ui.activeTab"
      :poi-edit-mode="ui.poiEditMode"
      :update-version="updateReleases[0]?.version ?? null"
      :check-state="updateCheckState"
      @select-tab="ui.setActiveTab($event)"
      @new-character="ui.openNewCharacter()"
      @new-group="ui.openNewGroup()"
      @new-poi="ui.togglePoiEditMode()"
      @new-story="ui.openNewStory()"
      @check-updates="runUpdateCheck"
      @open-update="updateModalOpen = true"
    >
      <template #subtitle>{{ subtitle }}</template>

      <template #transfer>
        <TransferButtons
          :error-message="importError"
          @export="handleExport"
          @import="handleImport"
        />
      </template>

      <CharactersPanel
        v-if="ui.activeTab === 'characters'"
        :characters="characters.characters"
        :groups="groups.groups"
        :selected-character-id="ui.selectedCharacterId"
        @edit="ui.openEditCharacter($event)"
        @center="handleCenterCharacter($event)"
        @select="handleCenterCharacter($event)"
        @hover="ui.setHoveredCharacter($event)"
        @unhover="handleUnhoverCharacter($event)"
        @card-ref="setCardRef($event.id, $event.el)"
      />

      <GroupsPanel
        v-else-if="ui.activeTab === 'groups'"
        :groups="groups.groups"
        @edit="ui.openEditGroup($event)"
      />

      <PoisPanel
        v-else-if="ui.activeTab === 'pois'"
        :pois="pois.pois"
        @edit="ui.openEditPoi($event)"
        @center="handleCenterPoi($event)"
        @remove="askRemovePoi($event)"
      />

      <StoriesPanel
        v-else
        :stories="stories.stories"
        @edit="ui.openEditStory($event)"
        @remove="askRemoveStory($event)"
      />
    </SidebarPanel>
    <MapView
      ref="mapView"
      :image-url="SKYRIM_MAP.url"
      :image-width="SKYRIM_MAP.width"
      :image-height="SKYRIM_MAP.height"
      :pois="pois.pois"
      :edit-mode="ui.poiEditMode"
      :characters="characters.characters"
      :show-pins="ui.showPins"
      :hovered-character-id="ui.hoveredCharacterId"
      :hovered-poi-id="ui.hoveredPoiId"
      :selected-character-id="ui.selectedCharacterId"
      :placement-active="ui.placement !== null"
      :character-edit-mode="ui.characterEditMode"
      :poi-move-mode="ui.poiMoveMode"
      @map-click="handleMapClick"
      @poi-click="ui.openEditPoi($event)"
      @poi-moved="handlePoiMoved"
      @character-moved="handleCharacterMoved"
      @toggle-pins="ui.togglePins()"
      @toggle-character-edit="ui.toggleCharacterEditMode()"
      @toggle-poi-move="ui.togglePoiMoveMode()"
      @pin-click="ui.selectPin($event)"
      @pin-hover="ui.setHoveredCharacter($event)"
      @pin-unhover="handleUnhoverCharacter($event)"
      @open-character="handleOpenCharacterFromPopup"
      @close-popup="ui.closeCharacterPopup()"
      @cancel-placement="ui.cancelPlacement()"
    />
    <NotesPanel ref="notesPanel" @error="actionError = describeError($event)" />

    <CharacterModal
      v-if="ui.characterModalTarget !== null"
      :character="editingCharacter"
      :groups="groups.groups"
      :all-characters="characters.characters"
      :placement-restore="ui.placementResult"
      @close="ui.closeCharacterModal()"
      @save="handleSaveCharacter"
      @delete="handleDeleteCharacter"
      @create-group="handleCreateGroup"
      @select-existing="ui.openEditCharacter($event)"
      @place="handleStartPlacement"
    />

    <!-- La clé remonte la modale au passage création → édition : le brouillon
         local n'est jamais resynchronisé depuis les props (#113). -->
    <GroupModal
      v-if="ui.groupModalTarget !== null"
      :key="ui.groupModalTarget"
      :group="editingGroup"
      @close="ui.closeGroupModal()"
      @create="handleCreateGroupAndEdit"
      @update="handleUpdateGroupFromModal"
      @delete="handleDeleteGroupFromModal"
    />

    <PoiEditModal
      v-if="ui.poiModalTarget !== null"
      :poi="editingPoi"
      :x="poiModalCoords.x"
      :y="poiModalCoords.y"
      @close="ui.closePoiModal()"
      @save="handleSavePoi"
      @delete="handleDeletePoi"
    />

    <!-- La clé remonte la modale au passage création → édition : le brouillon
         local n'est jamais resynchronisé depuis les props (#83). -->
    <StoryModal
      v-if="ui.storyModalTarget !== null"
      :key="ui.storyModalTarget"
      :story="editingStory"
      :all-characters="characters.characters"
      :all-groups="groups.groups"
      :all-pois="pois.pois"
      @close="ui.closeStoryModal()"
      @create="handleCreateStory"
      @update="handleUpdateStory"
      @delete="handleDeleteStory"
    />

    <ConfirmDialog
      v-if="storyPendingDelete"
      title="Supprimer l'histoire"
      :message="`Supprimer « ${storyPendingDelete.title} » ? Les personnages, groupes et lieux liés ne seront pas supprimés.`"
      @confirm="confirmRemoveStory"
      @cancel="storyPendingDelete = null"
    />

    <ConfirmDialog
      v-if="poiPendingDelete"
      title="Supprimer le point d'intérêt"
      :message="`Supprimer « ${poiPendingDelete.name} » ? Le lieu disparaîtra de la carte.`"
      @confirm="confirmRemovePoi"
      @cancel="poiPendingDelete = null"
    />

    <UpdateModal
      v-if="updateModalOpen && updateReleases.length > 0"
      :releases="updateReleases"
      @close="updateModalOpen = false"
    />

    <div v-if="actionError" class="app-error" role="alert">
      <span>{{ actionError }}</span>
      <ToolbarButton variant="ghost" label="Fermer" @click="actionError = null">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </ToolbarButton>
    </div>
  </main>
</template>

<style scoped>
/* Sidebar et carte côte à côte : la sidebar est une colonne du flux, jamais un
   panneau flottant, et la carte occupe tout l'espace restant (#51). */
.app {
  display: flex;
  height: 100vh;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sidebar__list-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  padding: 4px 4px 2px;
}

.empty-state {
  padding: 16px 4px;
  font-size: 0.82rem;
  color: var(--text-muted);
  text-align: center;
}

.app-error {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  background: var(--panel);
  border: 1px solid var(--rel-ennemi);
  border-radius: var(--radius-md);
  padding: 10px 8px 10px 14px;
  font-size: 0.84rem;
  color: var(--text);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
</style>
