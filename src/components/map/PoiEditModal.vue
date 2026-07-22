<script setup lang="ts">
import { ref } from 'vue'
import ModalShell from '../modals/ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from '../modals/ConfirmDialog.vue'
import { POI_TYPES } from '../../../shared/enums.ts'
import type { Poi, PoiInput } from '../../../shared/schemas.ts'

const props = defineProps<{
  poi: Poi | null
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  save: [PoiInput]
  delete: [string]
}>()

const isEditing = props.poi !== null
const name = ref(props.poi?.name ?? '')
const type = ref<Poi['type']>(props.poi?.type ?? 'landmark')
const pendingDelete = ref(false)

function submit(): void {
  const trimmed = name.value.trim()
  if (trimmed === '') return
  emit('save', { name: trimmed, type: type.value, x: props.x, y: props.y })
}
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>{{ isEditing ? 'Modifier le POI' : 'Nouveau POI' }}</template>

    <div class="field">
      <label for="poiName">Nom</label>
      <input id="poiName" v-model="name" type="text" autofocus />
    </div>
    <div class="field">
      <label for="poiType">Type</label>
      <select id="poiType" v-model="type">
        <option v-for="poiType in POI_TYPES" :key="poiType" :value="poiType">{{ poiType }}</option>
      </select>
    </div>
    <p class="coords">Coordonnées : ({{ Math.round(x) }}, {{ Math.round(y) }})</p>

    <template #footer>
      <ToolbarButton
        v-if="isEditing"
        variant="danger"
        label="Supprimer ce POI"
        @click="pendingDelete = true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 13h10l1-13" />
        </svg>
      </ToolbarButton>
      <div v-else />
      <div class="right">
        <ToolbarButton label="Annuler" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton variant="primary" label="Enregistrer" @click="submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>

  <ConfirmDialog
    v-if="pendingDelete && poi"
    title="Supprimer le POI"
    :message="`Supprimer « ${poi.name} » ?`"
    @confirm="
      () => {
        $emit('delete', poi!.id)
        pendingDelete = false
      }
    "
    @cancel="pendingDelete = false"
  />
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.field input,
.field select {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 0.86rem;
  color: var(--text);
}
.field input:focus,
.field select:focus {
  border-color: var(--accent-dim);
  outline: none;
}
.coords {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-muted);
  margin: 0;
}
.right {
  display: flex;
  gap: 8px;
}
</style>
