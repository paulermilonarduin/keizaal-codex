<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { api } from './api/singleton.ts'
import { useCharactersStore } from './stores/characters.store.ts'
import { useGroupsStore } from './stores/groups.store.ts'
import { usePoisStore } from './stores/pois.store.ts'
import { useUiStore } from './stores/ui.store.ts'
import { loadInitialData } from './stores/bootstrap.ts'
import { filterCharacters } from './lib/filterCharacters.ts'
import { RACES, RELATIONS } from '../shared/enums.ts'
import type { CharacterInput, GroupInput, PoiInput } from '../shared/schemas.ts'
import SidebarPanel from './components/layout/SidebarPanel.vue'
import ToolbarButton from './components/layout/ToolbarButton.vue'
import SearchBar from './components/sidebar/SearchBar.vue'
import FilterDropdown from './components/sidebar/FilterDropdown.vue'
import CharacterCard from './components/sidebar/CharacterCard.vue'
import CharacterModal from './components/modals/CharacterModal.vue'
import GroupsModal from './components/modals/GroupsModal.vue'
import MapView from './components/map/MapView.vue'
import PoiEditModal from './components/map/PoiEditModal.vue'

const SKYRIM_MAP = { url: '/map/skyrim.jpg', width: 2048, height: 1536 }

const characters = useCharactersStore()
const groups = useGroupsStore()
const pois = usePoisStore()
const ui = useUiStore()

onMounted(() => {
  void loadInitialData(api, { characters, groups, pois })
})

const raceOptions = RACES.map((race) => ({ value: race, label: race }))
const relationOptions = RELATIONS.map((relation) => ({ value: relation, label: relation }))
const groupOptions = computed(() =>
  groups.groups.map((group) => ({ value: group.id, label: group.name })),
)

const filteredCharacters = computed(() =>
  filterCharacters(characters.characters, {
    search: ui.searchQuery,
    race: ui.raceFilter,
    relation: ui.relationFilter,
    groupId: ui.groupFilter,
  }),
)

const editingCharacter = computed(() => {
  const target = ui.characterModalTarget
  if (target === null || target === 'new') return null
  return characters.characters.find((character) => character.id === target) ?? null
})

async function handleSaveCharacter(payload: {
  input: CharacterInput
  avatarBlob: Blob | null
}): Promise<void> {
  const target = ui.characterModalTarget
  const saved =
    target !== null && target !== 'new'
      ? await characters.update(target, payload.input)
      : await characters.create(payload.input)
  if (payload.avatarBlob !== null) {
    await characters.uploadAvatar(saved.id, payload.avatarBlob)
  }
  ui.closeCharacterModal()
}

async function handleDeleteCharacter(id: string): Promise<void> {
  await characters.remove(id)
  ui.closeCharacterModal()
}

async function handleCreateGroup(input: GroupInput): Promise<void> {
  await groups.create(input)
}
async function handleUpdateGroup(id: string, input: GroupInput): Promise<void> {
  await groups.update(id, input)
}
async function handleRemoveGroup(id: string): Promise<void> {
  await groups.remove(id)
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
  const poi = editingPoi.value
  if (poi !== null) await pois.update(poi.id, input)
  else await pois.create(input)
  ui.closePoiModal()
}

async function handleDeletePoi(id: string): Promise<void> {
  await pois.remove(id)
  ui.closePoiModal()
}

async function handlePoiMoved(payload: { id: string; x: number; y: number }): Promise<void> {
  const poi = pois.pois.find((p) => p.id === payload.id)
  if (poi === undefined) return
  await pois.update(poi.id, { name: poi.name, type: poi.type, x: payload.x, y: payload.y })
}
</script>

<template>
  <main class="app">
    <SidebarPanel>
      <template #subtitle>{{ characters.characters.length }} personnage(s) suivi(s)</template>
      <template #tools>
        <SearchBar v-model="ui.searchQuery" />
        <div class="filters">
          <FilterDropdown v-model="ui.raceFilter" label="Toutes races" :options="raceOptions" />
          <FilterDropdown
            v-model="ui.relationFilter"
            label="Toutes relations"
            :options="relationOptions"
          />
          <FilterDropdown
            v-model="ui.groupFilter"
            label="Tous les groupes"
            :options="groupOptions"
          />
        </div>
      </template>
      <template #list>
        <div class="sidebar__list-label">Personnages</div>
        <p v-if="characters.characters.length === 0" class="empty-state">
          Aucun personnage enregistré.
        </p>
        <p v-else-if="filteredCharacters.length === 0" class="empty-state">
          Aucun personnage ne correspond à ces critères.
        </p>
        <CharacterCard
          v-for="character in filteredCharacters"
          :key="character.id"
          :character="character"
          :groups="groups.groups"
          @edit="ui.openEditCharacter($event)"
        />
      </template>
      <template #footer>
        <ToolbarButton variant="primary" label="Ajouter un personnage" @click="ui.openNewCharacter()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </ToolbarButton>
        <ToolbarButton label="Groupes" @click="ui.openGroupsModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="8" r="3" />
            <path d="M2 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
            <circle cx="17" cy="9" r="2.4" />
            <path d="M16 14.3c2.6.4 4.5 2.2 4.5 5" />
          </svg>
        </ToolbarButton>
      </template>
    </SidebarPanel>
    <MapView
      :image-url="SKYRIM_MAP.url"
      :image-width="SKYRIM_MAP.width"
      :image-height="SKYRIM_MAP.height"
      :pois="pois.pois"
      :edit-mode="ui.poiEditMode"
      @toggle-edit-mode="ui.togglePoiEditMode()"
      @map-click="ui.openNewPoi($event.x, $event.y)"
      @poi-click="ui.openEditPoi($event)"
      @poi-moved="handlePoiMoved"
    />

    <CharacterModal
      v-if="ui.characterModalTarget !== null"
      :character="editingCharacter"
      :groups="groups.groups"
      :all-characters="characters.characters"
      @close="ui.closeCharacterModal()"
      @save="handleSaveCharacter"
      @delete="handleDeleteCharacter"
      @open-groups="ui.openGroupsModal()"
      @select-existing="ui.openEditCharacter($event)"
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
  </main>
</template>

<style scoped>
.app {
  position: relative;
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
</style>
