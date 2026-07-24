<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ModalShell from '../modals/ModalShell.vue'
import type { TransferBundle } from '../../../shared/schemas.ts'

defineProps<{ errorMessage: string | null }>()

const emit = defineEmits<{
  export: []
  import: [{ bundle: TransferBundle; mode: 'replace' | 'merge' }]
}>()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const pendingBundle = ref<TransferBundle | null>(null)
const parseError = ref<string | null>(null)

function triggerFilePicker(): void {
  fileInput.value?.click()
}

async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return

  parseError.value = null
  try {
    pendingBundle.value = JSON.parse(await file.text()) as TransferBundle
  } catch {
    parseError.value = 'Fichier illisible : ce n’est pas un export Codex Keizaal valide.'
  }
}

function chooseMode(mode: 'replace' | 'merge'): void {
  if (pendingBundle.value === null) return
  emit('import', { bundle: pendingBundle.value, mode })
  pendingBundle.value = null
}
</script>

<template>
  <ToolbarButton label="Exporter" @click="$emit('export')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  </ToolbarButton>
  <ToolbarButton label="Importer" @click="triggerFilePicker">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M4 19h16" />
    </svg>
  </ToolbarButton>
  <input
    ref="fileInput"
    type="file"
    accept="application/json"
    class="visually-hidden"
    @change="onFilePicked"
  />

  <ModalShell v-if="pendingBundle !== null" @close="pendingBundle = null">
    <template #title>Importer les données</template>
    <p class="message">
      Remplacer entièrement les données existantes, ou fusionner avec l'import (correspondance par
      gameId quand il est renseigné, sinon par id) ?
    </p>
    <template #footer>
      <div />
      <div class="right">
        <ToolbarButton label="Fusionner" @click="chooseMode('merge')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 4v6a4 4 0 0 0 4 4h4M18 4v6a4 4 0 0 1-4 4" />
            <path d="M14 12l4 2-4 2" />
          </svg>
        </ToolbarButton>
        <ToolbarButton variant="danger" label="Remplacer tout" @click="chooseMode('replace')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4v6h6" />
            <path d="M20 20v-6h-6" />
            <path d="M5.5 9A7 7 0 0 1 19 9M18.5 15a7 7 0 0 1-13.5 0" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>

  <p v-if="parseError ?? errorMessage" class="transfer-error">{{ parseError ?? errorMessage }}</p>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.message {
  color: var(--text);
  font-size: 0.9rem;
  margin: 0;
}
.right {
  display: flex;
  gap: 8px;
}
.transfer-error {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 30;
  max-width: 320px;
  background: var(--panel);
  border: 1px solid var(--rel-ennemi);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 0.8rem;
  color: var(--text);
}
</style>
