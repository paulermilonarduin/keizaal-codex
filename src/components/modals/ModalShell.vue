<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal-overlay" @click="$event.target === $event.currentTarget && $emit('close')">
    <div class="modal">
      <div class="modal__header">
        <h2><slot name="title" /></h2>
        <ToolbarButton variant="ghost" label="Fermer" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
      </div>
      <div class="modal__body"><slot /></div>
      <div v-if="$slots.footer" class="modal__footer"><slot name="footer" /></div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 24px;
}

.modal {
  width: min(440px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.modal__header h2 {
  font-size: 1.15rem;
}
.modal__body {
  padding: 18px 20px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}
</style>
