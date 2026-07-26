<script setup lang="ts">
import { computed } from 'vue'
import SearchBar from './SearchBar.vue'
import GroupsList from '../groups/GroupsList.vue'
import GroupCreateRow from '../groups/GroupCreateRow.vue'
import { filterGroups } from '../../lib/filterGroups.ts'
import { useUiStore } from '../../stores/ui.store.ts'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

// Même contrat que CharactersPanel : lit l'état d'interface, remonte les
// mutations de domaine pour que la gestion d'erreur reste dans App.vue
// (ARCHITECTURE.md §5.3).
const props = defineProps<{ groups: Group[] }>()

defineEmits<{ create: [GroupInput]; update: [string, GroupInput]; remove: [string] }>()

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
    <GroupsList
      v-else
      :groups="filtered"
      with-description
      @update="(id, input) => $emit('update', id, input)"
      @remove="$emit('remove', $event)"
    />
  </div>

  <div class="sidebar__footer sidebar__footer--stack">
    <GroupCreateRow @create="$emit('create', $event)" />
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
/* La ligne de création occupe toute la largeur du pied, contrairement aux
   boutons icône du pied Personnages alignés en ligne. */
.sidebar__footer--stack :deep(.group-row) {
  flex: 1;
  min-width: 0;
}
</style>
