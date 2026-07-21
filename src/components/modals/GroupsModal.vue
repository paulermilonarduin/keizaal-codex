<script setup lang="ts">
import { ref } from 'vue'
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

defineProps<{ groups: Group[] }>()
const emit = defineEmits<{
  close: []
  create: [GroupInput]
  update: [string, GroupInput]
  remove: [string]
}>()

const newName = ref('')
const newColor = ref('#d9b54a')
const pendingDelete = ref<Group | null>(null)

function submitNew(): void {
  const name = newName.value.trim()
  if (name === '') return
  emit('create', { name, color: newColor.value })
  newName.value = ''
}

function renameGroup(group: Group, name: string): void {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === group.name) return
  emit('update', group.id, { name: trimmed, color: group.color, description: group.description })
}

function recolorGroup(group: Group, color: string): void {
  emit('update', group.id, { name: group.name, color, description: group.description })
}

function confirmDelete(): void {
  if (pendingDelete.value === null) return
  emit('remove', pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>Groupes</template>

    <p v-if="groups.length === 0" class="empty">Aucun groupe pour l'instant.</p>
    <ul v-else class="group-list">
      <li v-for="group in groups" :key="group.id" class="group-row">
        <input
          type="color"
          class="swatch"
          aria-label="Couleur du groupe"
          :value="group.color ?? '#d9b54a'"
          @change="recolorGroup(group, ($event.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          class="name"
          aria-label="Nom du groupe"
          :value="group.name"
          @change="renameGroup(group, ($event.target as HTMLInputElement).value)"
        />
        <ToolbarButton variant="danger" label="Supprimer" @click="pendingDelete = group">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13h10l1-13" />
          </svg>
        </ToolbarButton>
      </li>
    </ul>

    <div class="new-group">
      <input v-model="newColor" type="color" class="swatch" aria-label="Couleur du nouveau groupe" />
      <input
        v-model="newName"
        type="text"
        class="name"
        placeholder="Nouveau groupe…"
        @keyup.enter="submitNew"
      />
      <ToolbarButton variant="primary" label="Créer le groupe" @click="submitNew">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </ToolbarButton>
    </div>
  </ModalShell>

  <ConfirmDialog
    v-if="pendingDelete"
    title="Supprimer le groupe"
    :message="`Supprimer « ${pendingDelete.name} » ? Les personnages qui en font partie ne seront pas supprimés.`"
    @confirm="confirmDelete"
    @cancel="pendingDelete = null"
  />
</template>

<style scoped>
.empty {
  color: var(--text-muted);
  font-size: 0.86rem;
  margin: 0;
}
.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group-row,
.new-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.new-group {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.swatch {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
}
.name {
  flex: 1;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 9px;
  font-size: 0.86rem;
  color: var(--text);
}
.name:focus {
  border-color: var(--accent-dim);
  outline: none;
}
</style>
