<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api } from './api/singleton.ts'
import { useCharactersStore } from './stores/characters.store.ts'
import { useGroupsStore } from './stores/groups.store.ts'
import { usePoisStore } from './stores/pois.store.ts'
import { useUiStore } from './stores/ui.store.ts'
import { loadInitialData } from './stores/bootstrap.ts'
import { nearestPoi } from './lib/nearestPoi.ts'
import { exportFilename } from './lib/exportFilename.ts'
import { describeError } from './lib/describeError.ts'
import type { CharacterInput, GroupInput, PoiInput, TransferBundle } from '../shared/schemas.ts'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import ToolbarButton from './components/layout/ToolbarButton.vue'
import CharactersPanel from './components/sidebar/CharactersPanel.vue'
import CharacterModal from './components/modals/CharacterModal.vue'
import GroupsModal from './components/modals/GroupsModal.vue'
import MapView from './components/map/MapView.vue'
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
const ui = useUiStore()

onMounted(() => {
  void loadInitialData(api, { characters, groups, pois })
})

// Le sous-titre du header suit l'onglet actif : il commente la section affichée.
const subtitle = computed(() => {
  if (ui.activeTab === 'groups') return `${groups.groups.length} groupe(s)`
  if (ui.activeTab === 'pois') return `${pois.pois.length} point(s) d'intérêt`
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
}): Promise<void> {
  try {
    const target = ui.characterModalTarget
    const saved =
      target !== null && target !== 'new'
        ? await characters.update(target, payload.input)
        : await characters.create(payload.input)
    if (payload.avatarBlob !== null) {
      await characters.uploadAvatar(saved.id, payload.avatarBlob)
    }
    ui.closeCharacterModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleDeleteCharacter(id: string): Promise<void> {
  try {
    await characters.remove(id)
    ui.closeCharacterModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
}

async function handleCreateGroup(input: GroupInput): Promise<void> {
  try {
    await groups.create(input)
  } catch (error) {
    actionError.value = describeError(error)
  }
}
async function handleUpdateGroup(id: string, input: GroupInput): Promise<void> {
  try {
    await groups.update(id, input)
  } catch (error) {
    actionError.value = describeError(error)
  }
}
async function handleRemoveGroup(id: string): Promise<void> {
  try {
    await groups.remove(id)
  } catch (error) {
    actionError.value = describeError(error)
  }
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
    ui.closePoiModal()
  } catch (error) {
    actionError.value = describeError(error)
  }
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

function handleMapClick(point: { x: number; y: number }): void {
  if (ui.placement !== null) {
    const label = nearestPoi(point.x, point.y, pois.pois)?.name
    ui.completePlacement(point.x, point.y, label)
    return
  }
  ui.openNewPoi(point.x, point.y)
}

function handleStartPlacement(payload: { kind: 'home' | 'known'; draft: unknown }): void {
  ui.startPlacement(payload.kind, payload.draft)
}

const centerTarget = ref<{ x: number; y: number } | null>(null)

function centerOnPosition(x: number, y: number): void {
  centerTarget.value = { x, y }
}

function handleCenterKnown(id: string): void {
  const position = characters.characters.find((c) => c.id === id)?.knownPosition
  if (position !== undefined) centerOnPosition(position.x, position.y)
}

function handleSelectCharacter(id: string): void {
  const character = characters.characters.find((c) => c.id === id)
  const position = character?.knownPosition ?? character?.homePosition
  if (position !== undefined) centerOnPosition(position.x, position.y)
}

function handlePinClick(pin: { characterId: string; kind: 'home' | 'known' }): void {
  ui.selectPin(pin.characterId, pin.kind)
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
  () => ui.selectedPin,
  (pin) => {
    if (pin === null) return
    cardEls.get(pin.characterId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
  try {
    await api.transfer.import(payload.bundle, payload.mode)
    await loadInitialData(api, { characters, groups, pois })
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
      @select-tab="ui.setActiveTab($event)"
    >
      <template #subtitle>{{ subtitle }}</template>

      <CharactersPanel
        v-if="ui.activeTab === 'characters'"
        :characters="characters.characters"
        :groups="groups.groups"
        :selected-character-id="ui.selectedPin?.characterId ?? null"
        @create="ui.openNewCharacter()"
        @edit="ui.openEditCharacter($event)"
        @center="handleCenterKnown($event)"
        @select="handleSelectCharacter($event)"
        @hover="ui.setHoveredCharacter($event)"
        @unhover="handleUnhoverCharacter($event)"
        @card-ref="setCardRef($event.id, $event.el)"
      >
        <template #footer-extra>
          <ToolbarButton label="Groupes" @click="ui.openGroupsModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="8" r="3" />
              <path d="M2 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M16 14.3c2.6.4 4.5 2.2 4.5 5" />
            </svg>
          </ToolbarButton>
          <TransferButtons
            :error-message="importError"
            @export="handleExport"
            @import="handleImport"
          />
        </template>
      </CharactersPanel>

      <!-- Onglets Groupes et Points d'intérêt : livrés dans #53 et #54. -->
      <div v-else class="sidebar__list">
        <p class="empty-state">Bientôt disponible.</p>
      </div>
    </SidebarPanel>
    <MapView
      :image-url="SKYRIM_MAP.url"
      :image-width="SKYRIM_MAP.width"
      :image-height="SKYRIM_MAP.height"
      :pois="pois.pois"
      :edit-mode="ui.poiEditMode"
      :characters="characters.characters"
      :show-home-pins="ui.showHomePins"
      :show-known-pins="ui.showKnownPins"
      :hovered-character-id="ui.hoveredCharacterId"
      :selected-pin="ui.selectedPin"
      :center-target="centerTarget"
      :placement-active="ui.placement !== null"
      @toggle-edit-mode="ui.togglePoiEditMode()"
      @map-click="handleMapClick"
      @poi-click="ui.openEditPoi($event)"
      @poi-moved="handlePoiMoved"
      @toggle-home-pins="ui.toggleHomePins()"
      @toggle-known-pins="ui.toggleKnownPins()"
      @pin-click="handlePinClick"
      @pin-hover="ui.setHoveredCharacter($event)"
      @pin-unhover="handleUnhoverCharacter($event)"
      @open-character="handleOpenCharacterFromPopup"
      @close-popup="ui.closeCharacterPopup()"
      @cancel-placement="ui.cancelPlacement()"
    />

    <CharacterModal
      v-if="ui.characterModalTarget !== null"
      :character="editingCharacter"
      :groups="groups.groups"
      :all-characters="characters.characters"
      :placement-restore="ui.placementResult"
      @close="ui.closeCharacterModal()"
      @save="handleSaveCharacter"
      @delete="handleDeleteCharacter"
      @open-groups="ui.openGroupsModal()"
      @select-existing="ui.openEditCharacter($event)"
      @place="handleStartPlacement"
    />

    <GroupsModal
      v-if="ui.groupsModalOpen"
      :groups="groups.groups"
      @close="ui.closeGroupsModal()"
      @create="handleCreateGroup"
      @update="handleUpdateGroup"
      @remove="handleRemoveGroup"
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
