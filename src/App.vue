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
import SidebarPanel from './components/layout/SidebarPanel.vue'
import SearchBar from './components/sidebar/SearchBar.vue'
import FilterDropdown from './components/sidebar/FilterDropdown.vue'
import CharacterCard from './components/sidebar/CharacterCard.vue'

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
</script>

<template>
  <main class="app">
    <SidebarPanel>
      <template #subtitle>{{ characters.characters.length }} personnage(s) suivi(s)</template>
      <template #tools>
        <SearchBar v-model="ui.searchQuery" />
        <div class="filters">
          <FilterDropdown
            v-model="ui.raceFilter"
            label="Toutes races"
            :options="raceOptions"
          />
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
        />
      </template>
    </SidebarPanel>
    <div class="map-placeholder" />
  </main>
</template>

<style scoped>
.app {
  position: relative;
  height: 100vh;
}
.map-placeholder {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      1100px 700px at 18% 20%,
      color-mix(in srgb, var(--accent) 10%, var(--bg) 90%),
      transparent 60%
    ),
    radial-gradient(
      900px 620px at 82% 78%,
      color-mix(in srgb, var(--rel-inconnu) 22%, var(--bg) 78%),
      transparent 65%
    ),
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--bg) 92%, black 8%),
      var(--bg) 55%,
      color-mix(in srgb, var(--bg) 88%, white 12%)
    );
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
