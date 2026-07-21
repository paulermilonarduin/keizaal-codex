<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'

defineProps<{ title: string; message: string }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ModalShell @close="$emit('cancel')">
    <template #title>{{ title }}</template>
    <p class="message">{{ message }}</p>
    <template #footer>
      <div />
      <div class="right">
        <ToolbarButton label="Annuler" @click="$emit('cancel')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton variant="danger" label="Confirmer" @click="$emit('confirm')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>
</template>

<style scoped>
.message {
  color: var(--text);
  font-size: 0.9rem;
  margin: 0;
}
.right {
  display: flex;
  gap: 8px;
}
</style>
