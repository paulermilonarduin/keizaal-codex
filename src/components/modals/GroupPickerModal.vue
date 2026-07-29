<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalShell from './ModalShell.vue'
import SearchBar from '../sidebar/SearchBar.vue'
import GroupCreateRow from '../groups/GroupCreateRow.vue'
import { filterGroups } from '../../lib/filterGroups.ts'
import { appearedGroupId, toggledIds } from '../../lib/groupPicker.ts'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

// Modale de sélection ouverte depuis la fiche personnage (#114) : elle assigne
// et désassigne des groupes sur le brouillon de la fiche, jamais en base. Seule
// la création d'un groupe part immédiatement au serveur (remontée au parent).
const props = defineProps<{ groups: Group[]; selectedIds: string[] }>()

const emit = defineEmits<{
  close: []
  create: [GroupInput]
  'update:selectedIds': [string[]]
}>()

// Recherche locale : elle ne survit pas à la fermeture, contrairement à celle de
// l'onglet Groupes (ui.groupSearch) qui est un filtre de navigation.
const search = ref('')

const filtered = computed(() => filterGroups(props.groups, search.value))

function toggle(id: string): void {
  emit('update:selectedIds', toggledIds(props.selectedIds, id))
}

// Le groupe créé doit se retrouver coché : le store ne remonte pas l'id créé,
// on repère donc celui qui apparaît dans la liste après une création demandée
// ici. `pendingCreation` évite de cocher un groupe apparu autrement.
let knownIds = props.groups.map((group) => group.id)
let pendingCreation = false

function requestCreation(input: GroupInput): void {
  pendingCreation = true
  emit('create', input)
}

// `deep` indispensable : le store ajoute le groupe créé dans le tableau existant
// (push), la référence de la prop ne change donc jamais. Les autres mutations
// (renommage, couleur) réveillent bien l'observateur, sans effet : rien n'est
// apparu, appearedGroupId rend null.
watch(
  () => props.groups,
  (groups) => {
    const appeared = appearedGroupId(knownIds, groups)
    knownIds = groups.map((group) => group.id)
    if (!pendingCreation || appeared === null) return
    pendingCreation = false
    emit('update:selectedIds', toggledIds(props.selectedIds, appeared))
  },
  { deep: true },
)
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>Groupes</template>

    <SearchBar
      v-model="search"
      placeholder="Rechercher un groupe…"
      aria-label="Rechercher un groupe"
    />

    <p v-if="groups.length === 0" class="empty">Aucun groupe pour l'instant.</p>
    <p v-else-if="filtered.length === 0" class="empty">Aucun groupe ne correspond.</p>
    <ul v-else class="picker-list">
      <li v-for="group in filtered" :key="group.id">
        <label class="picker-row">
          <input
            type="checkbox"
            :checked="selectedIds.includes(group.id)"
            @change="toggle(group.id)"
          />
          <span class="dot" :style="{ background: group.color ?? 'var(--text-muted)' }" />
          <span class="picker-name">{{ group.name }}</span>
        </label>
      </li>
    </ul>

    <!-- Pas de pied de modale : il n'y a rien à valider, la sélection est
         appliquée au brouillon de la fiche au fil des clics. -->
    <div class="separator">
      <GroupCreateRow @create="requestCreation" />
    </div>
  </ModalShell>
</template>

<style scoped>
.empty {
  color: var(--text-muted);
  font-size: 0.86rem;
  margin: 0;
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
}
.picker-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.86rem;
  color: var(--text);
  cursor: pointer;
}
.picker-row:hover {
  background: var(--card);
}
.picker-row input {
  flex: none;
  accent-color: var(--accent);
  cursor: pointer;
}
.picker-row .dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.picker-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.separator {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
</style>
