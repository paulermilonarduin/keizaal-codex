<script setup lang="ts">
import type { Group } from '../../../shared/schemas.ts'

// Carte cliquable de l'onglet Groupes (#113) : elle ouvre la modale dédiée,
// l'édition inline a disparu. Pas de bouton d'action, la suppression vit dans la
// modale.
defineProps<{ group: Group }>()

defineEmits<{ edit: [string] }>()
</script>

<template>
  <article
    class="group-card"
    role="button"
    tabindex="0"
    @click="$emit('edit', group.id)"
    @keydown.enter="$emit('edit', group.id)"
    @keydown.space.prevent="$emit('edit', group.id)"
  >
    <!-- Bande latérale à la couleur du groupe : la couleur est son seul repère
         visuel, elle remplace la pastille de l'édition inline. -->
    <span class="group-card__band" :style="{ background: group.color ?? 'var(--accent-dim)' }" />
    <div class="group-card__body">
      <div class="group-card__name">{{ group.name }}</div>
      <div v-if="group.description" class="group-card__description">{{ group.description }}</div>
    </div>
  </article>
</template>

<style scoped>
/* Même grammaire visuelle que StoryCard et PoiCard : pas de fond, une bande
   colorée à gauche, le texte tronqué plutôt que replié (la sidebar fait 340px). */
.group-card {
  position: relative;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 9px 10px 9px 16px;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    transform 0.12s ease;
}
.group-card__band {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
.group-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.group-card__body {
  min-width: 0;
}
.group-card__name {
  font-size: 0.92rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-card__description {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
