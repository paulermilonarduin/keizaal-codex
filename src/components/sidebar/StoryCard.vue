<script setup lang="ts">
import { computed } from 'vue'
import type { Story } from '../../../shared/schemas.ts'

const props = defineProps<{ story: Story }>()

defineEmits<{ edit: [string]; remove: [string] }>()

// La date est stockée en ISO (#83) mais se lit en français dans la liste.
const dateLabel = computed(() =>
  props.story.date === undefined
    ? ''
    : new Date(props.story.date).toLocaleDateString('fr-FR'),
)

// Compteur sobre plutôt que la liste des entités : la sidebar n'a que 340px, et
// le détail des liens est l'affaire de la modale.
const linksLabel = computed(() => {
  const parts: string[] = []
  if (props.story.characters.length > 0) {
    parts.push(`${props.story.characters.length} personnage(s)`)
  }
  if (props.story.groups.length > 0) parts.push(`${props.story.groups.length} groupe(s)`)
  if (props.story.pois.length > 0) parts.push(`${props.story.pois.length} lieu(x)`)
  return parts.join(' · ')
})
</script>

<template>
  <article
    class="story-card"
    role="button"
    tabindex="0"
    @click="$emit('edit', story.id)"
    @keydown.enter="$emit('edit', story.id)"
    @keydown.space.prevent="$emit('edit', story.id)"
  >
    <div class="story-card__body">
      <div class="story-card__title">{{ story.title }}</div>
      <div v-if="dateLabel" class="story-card__date">{{ dateLabel }}</div>
      <div v-if="linksLabel" class="story-card__links">{{ linksLabel }}</div>
    </div>

    <div class="story-card__actions">
      <button
        type="button"
        class="btn btn-icon is-danger"
        aria-label="Supprimer"
        @click.stop="$emit('remove', story.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 13h10l1-13" />
        </svg>
      </button>
    </div>
  </article>
</template>

<style scoped>
/* Même grammaire visuelle que PoiCard, avec la bande dorée de l'accent : une
   histoire n'a ni relation ni type. */
.story-card {
  position: relative;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 9px 10px 9px 16px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    transform 0.12s ease;
}
.story-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent-dim);
}
.story-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.story-card__body {
  min-width: 0;
}
.story-card__title {
  font-size: 0.92rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.story-card__date {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.story-card__links {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.story-card__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.story-card__actions .btn-icon {
  width: 26px;
  height: 26px;
  padding: 5px;
}
.story-card__actions .btn-icon svg {
  width: 13px;
  height: 13px;
}
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.btn-icon:hover {
  background: color-mix(in srgb, var(--bg) 80%, var(--text) 20%);
  border-color: var(--border-strong);
}
.btn-icon.is-danger {
  color: var(--rel-ennemi);
}
</style>
