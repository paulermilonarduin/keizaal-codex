<script setup lang="ts">
import { ref } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from '../modals/ConfirmDialog.vue'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

// Liste éditable partagée par la modale Groupes et l'onglet Groupes (#53) :
// l'édition inline couleur/nom et la suppression confirmée ne vivent qu'ici.
// Elle reçoit les groupes déjà filtrés — c'est au parent de décider s'il y a une
// recherche (la modale n'en a pas) et quoi afficher quand la liste est vide.
defineProps<{ groups: Group[] }>()

const emit = defineEmits<{ update: [string, GroupInput]; remove: [string] }>()

const pendingDelete = ref<Group | null>(null)

// Un renommage vide ou identique n'est pas une modification : on évite l'appel
// serveur (écriture pessimiste, ARCHITECTURE.md §5.2).
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
  <ul class="group-list">
    <li v-for="group in groups" :key="group.id" class="group-row">
      <input
        type="color"
        class="group-swatch"
        aria-label="Couleur du groupe"
        :value="group.color ?? '#d9b54a'"
        @change="recolorGroup(group, ($event.target as HTMLInputElement).value)"
      />
      <input
        type="text"
        class="group-name"
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

  <!-- Teleport indispensable : utilisée depuis la modale Groupes, cette liste
       est un descendant de .modal-overlay, dont le backdrop-filter crée un bloc
       conteneur — le position: fixed de la confirmation s'y retrouverait piégé,
       centré sur l'overlay au lieu de l'écran. -->
  <Teleport to="body">
    <ConfirmDialog
      v-if="pendingDelete"
      title="Supprimer le groupe"
      :message="`Supprimer « ${pendingDelete.name} » ? Les personnages qui en font partie ne seront pas supprimés.`"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </Teleport>
</template>

<style scoped>
.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
