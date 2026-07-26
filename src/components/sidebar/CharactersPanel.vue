<script setup lang="ts">
import { computed } from 'vue'
import SearchBar from './SearchBar.vue'
import FilterDropdown from './FilterDropdown.vue'
import CharacterCard from './CharacterCard.vue'
import { filterCharacters } from '../../lib/filterCharacters.ts'
import { RACES, RELATIONS } from '../../../shared/enums.ts'
import { useUiStore } from '../../stores/ui.store.ts'
import type { Character, Group } from '../../../shared/schemas.ts'

// Panneau « conteneur » : il lit l'état d'interface (store ui) et les listes en
// lecture, mais remonte toute mutation de domaine en événement — la gestion
// d'erreur reste ainsi centralisée dans App.vue (cf. ARCHITECTURE.md §5.3).
const props = defineProps<{
  characters: Character[]
  groups: Group[]
  selectedCharacterId: string | null
}>()

const emit = defineEmits<{
  edit: [string]
  center: [string]
  select: [string]
  hover: [string]
  unhover: [string]
  'card-ref': [{ id: string; el: unknown }]
}>()

const ui = useUiStore()

const raceOptions = RACES.map((race) => ({ value: race, label: race }))
const relationOptions = RELATIONS.map((relation) => ({ value: relation, label: relation }))
const groupOptions = computed(() =>
  props.groups.map((group) => ({ value: group.id, label: group.name })),
)

const filtered = computed(() =>
  filterCharacters(props.characters, {
    search: ui.characterSearch,
    race: ui.raceFilter,
    relation: ui.relationFilter,
    groupId: ui.groupFilter,
  }),
)
</script>

<template>
  <div class="sidebar__tools">
    <SearchBar v-model="ui.characterSearch" />
    <div class="filters">
      <FilterDropdown v-model="ui.raceFilter" label="Toutes races" :options="raceOptions" />
      <FilterDropdown
        v-model="ui.relationFilter"
        label="Toutes relations"
        :options="relationOptions"
      />
      <FilterDropdown v-model="ui.groupFilter" label="Tous les groupes" :options="groupOptions" />
    </div>
  </div>

  <div class="sidebar__list">
    <div class="list-label">Personnages</div>
    <p v-if="characters.length === 0" class="empty-state">Aucun personnage enregistré.</p>
    <p v-else-if="filtered.length === 0" class="empty-state">
      Aucun personnage ne correspond à ces critères.
    </p>
    <CharacterCard
      v-for="character in filtered"
      :key="character.id"
      :ref="(el) => emit('card-ref', { id: character.id, el })"
      :character="character"
      :groups="groups"
      :highlighted="character.id === ui.hoveredCharacterId || character.id === selectedCharacterId"
      @edit="emit('edit', $event)"
      @center="emit('center', $event)"
      @select="emit('select', $event)"
      @hover="emit('hover', $event)"
      @unhover="emit('unhover', $event)"
    />
  </div>

</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.list-label {
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
