<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '../../../shared/schemas.ts'

// Pastille ronde partagée par la carte de personnage, la mini-fiche de pin
// et la modale histoire. `title` reste facultatif : sans lui, l'avatar est
// purement décoratif (alt vide, pas d'attribut title).
const props = withDefaults(
  defineProps<{
    character: Character
    size?: number
    title?: string
  }>(),
  { size: 42, title: undefined },
)

const sizePx = computed(() => `${props.size}px`)
</script>

<template>
  <img
    v-if="character.avatar"
    class="avatar"
    :src="`/${character.avatar}`"
    :alt="title ?? ''"
    :title="title"
  />
  <div v-else class="avatar unknown" :title="title">?</div>
</template>

<style scoped>
.avatar {
  width: v-bind(sizePx);
  height: v-bind(sizePx);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  color: rgba(255, 255, 255, 0.92);
  border: 2px solid var(--border);
}
.avatar.unknown {
  color: var(--text-muted);
  border-style: dashed;
}
</style>
