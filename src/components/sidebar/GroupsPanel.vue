<script setup lang="ts">
import { computed } from 'vue'
import SearchBar from './SearchBar.vue'
import GroupCard from './GroupCard.vue'
import { filterGroups } from '../../lib/filterGroups.ts'
import { useUiStore } from '../../stores/ui.store.ts'
import type { Group } from '../../../shared/schemas.ts'

// Même contrat que CharactersPanel et StoriesPanel : lit l'état d'interface,
// remonte les mutations de domaine pour que la gestion d'erreur reste dans
// App.vue (ARCHITECTURE.md §5.3).
// Plus aucune édition inline depuis #113 : chaque carte ouvre la modale dédiée,
// où vivent nom, couleur, description, notes et suppression.
const props = defineProps<{ groups: Group[] }>()

defineEmits<{ edit: [string] }>()

const ui = useUiStore()

const filtered = computed(() => filterGroups(props.groups, ui.groupSearch))
</script>

<template>
  <div class="sidebar__tools">
    <SearchBar
      v-model="ui.groupSearch"
      placeholder="Rechercher un groupe…"
      aria-label="Rechercher un groupe"
    />
  </div>

  <div class="sidebar__list">
    <div class="list-label">Groupes</div>
    <p v-if="groups.length === 0" class="empty-state">Aucun groupe enregistré.</p>
    <p v-else-if="filtered.length === 0" class="empty-state">Aucun groupe ne correspond.</p>
    <GroupCard
      v-for="group in filtered"
      :key="group.id"
      :group="group"
      @edit="$emit('edit', $event)"
    />
  </div>
</template>

<style scoped>
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
