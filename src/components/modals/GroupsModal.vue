<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import GroupsList from '../groups/GroupsList.vue'
import GroupCreateRow from '../groups/GroupCreateRow.vue'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

// Conservée en parallèle de l'onglet Groupes (décision de Paul) : elle reste
// accessible depuis « + groupe » de la fiche personnage, sans perdre la saisie
// en cours. Tout son contenu vient désormais des composants partagés (#53).
defineProps<{ groups: Group[] }>()
defineEmits<{
  close: []
  create: [GroupInput]
  update: [string, GroupInput]
  remove: [string]
}>()
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>Groupes</template>

    <p v-if="groups.length === 0" class="empty">Aucun groupe pour l'instant.</p>
    <GroupsList
      v-else
      :groups="groups"
      @update="(id, input) => $emit('update', id, input)"
      @remove="$emit('remove', $event)"
    />

    <div class="separator">
      <GroupCreateRow @create="$emit('create', $event)" />
    </div>
  </ModalShell>
</template>

<style scoped>
.empty {
  color: var(--text-muted);
  font-size: 0.86rem;
  margin: 0;
}
.separator {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
</style>
