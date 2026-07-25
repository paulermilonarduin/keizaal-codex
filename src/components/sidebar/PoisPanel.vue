<script setup lang="ts">
import { computed } from 'vue'
import SearchBar from './SearchBar.vue'
import FilterDropdown from './FilterDropdown.vue'
import PoiCard from './PoiCard.vue'
import { filterPois } from '../../lib/filterPois.ts'
import { POI_TYPES, POI_TYPE_LABELS } from '../../../shared/enums.ts'
import { useUiStore } from '../../stores/ui.store.ts'
import type { Poi } from '../../../shared/schemas.ts'

// Même contrat que CharactersPanel et GroupsPanel : lit l'état d'interface,
// remonte les mutations de domaine (ARCHITECTURE.md §5.3).
const props = defineProps<{ pois: Poi[] }>()

defineEmits<{ edit: [string]; center: [string]; remove: [string] }>()

const ui = useUiStore()

const typeOptions = POI_TYPES.map((type) => ({ value: type, label: POI_TYPE_LABELS[type] }))

const filtered = computed(() =>
  filterPois(props.pois, { search: ui.poiSearch, type: ui.poiTypeFilter }),
)
</script>

<template>
  <div class="sidebar__tools">
    <SearchBar
      v-model="ui.poiSearch"
      placeholder="Rechercher un lieu…"
      aria-label="Rechercher un point d'intérêt"
    />
    <div class="filters">
      <FilterDropdown v-model="ui.poiTypeFilter" label="Tous les types" :options="typeOptions" />
    </div>
  </div>

  <div class="sidebar__list">
    <div class="list-label">Points d'intérêt</div>
    <!-- Depuis #50 il n'y a plus aucun seed : la liste est vide au premier
         lancement, l'état vide doit donc dire comment en créer. -->
    <p v-if="pois.length === 0" class="empty-state">
      Aucun point d'intérêt. Passez en mode édition sur la carte pour en créer.
    </p>
    <p v-else-if="filtered.length === 0" class="empty-state">
      Aucun point d'intérêt ne correspond à ces critères.
    </p>
    <PoiCard
      v-for="poi in filtered"
      :key="poi.id"
      :poi="poi"
      :highlighted="poi.id === ui.hoveredPoiId"
      @edit="$emit('edit', $event)"
      @center="$emit('center', $event)"
      @remove="$emit('remove', $event)"
      @hover="ui.setHoveredPoi($event)"
      @unhover="ui.hoveredPoiId === $event && ui.setHoveredPoi(null)"
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
