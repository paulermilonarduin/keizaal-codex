<script setup lang="ts">
import { ref } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import type { GroupInput } from '../../../shared/schemas.ts'

// Ligne de création partagée (#53), aujourd'hui utilisée par la modale de
// sélection des groupes de la fiche personnage (#114) : elle y enchaîne la liste
// cochable et cette ligne, qui crée un groupe et le coche aussitôt.
const emit = defineEmits<{ create: [GroupInput] }>()

const name = ref('')
const color = ref('#d9b54a')

function submit(): void {
  const trimmed = name.value.trim()
  if (trimmed === '') return
  emit('create', { name: trimmed, color: color.value })
  name.value = ''
}
</script>

<template>
  <div class="group-row new-group">
    <input
      v-model="color"
      type="color"
      class="group-swatch"
      aria-label="Couleur du nouveau groupe"
    />
    <input
      v-model="name"
      type="text"
      class="group-name"
      placeholder="Nouveau groupe…"
      aria-label="Nom du nouveau groupe"
      @keyup.enter="submit"
    />
    <ToolbarButton variant="primary" label="Créer le groupe" @click="submit">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </ToolbarButton>
  </div>
</template>
