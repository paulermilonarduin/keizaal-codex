<script setup lang="ts">
import { computed } from 'vue'
import { POI_TYPE_LABELS } from '../../../shared/enums.ts'
import type { Poi } from '../../../shared/schemas.ts'

const props = defineProps<{ poi: Poi; highlighted?: boolean }>()

defineEmits<{
  edit: [string]
  center: [string]
  remove: [string]
  hover: [string]
  unhover: [string]
}>()

const typeLabel = computed(() => POI_TYPE_LABELS[props.poi.type])
const coords = computed(() => `${Math.round(props.poi.x)}, ${Math.round(props.poi.y)}`)
</script>

<template>
  <article
    class="poi-card"
    :class="{ 'is-highlighted': highlighted }"
    role="button"
    tabindex="0"
    @click="$emit('center', poi.id)"
    @keydown.enter="$emit('center', poi.id)"
    @keydown.space.prevent="$emit('center', poi.id)"
    @mouseenter="$emit('hover', poi.id)"
    @mouseleave="$emit('unhover', poi.id)"
  >
    <div class="poi-card__body">
      <div class="poi-card__name">{{ poi.name }}</div>
      <div class="poi-card__meta">
        {{ typeLabel }} <span class="coords">({{ coords }})</span>
      </div>
    </div>

    <div class="poi-card__actions">
      <button
        type="button"
        class="btn btn-icon"
        aria-label="Modifier"
        @click.stop="$emit('edit', poi.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn-icon is-danger"
        aria-label="Supprimer"
        @click.stop="$emit('remove', poi.id)"
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
/* Même grammaire visuelle que CharacterCard, avec la bande de relation
   remplacée par la couleur POI (#49) — un POI n'a pas de relation. */
.poi-card {
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
.poi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--poi);
}
.poi-card:hover,
.poi-card.is-highlighted {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.poi-card__body {
  min-width: 0;
}
.poi-card__name {
  font-size: 0.92rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-card__meta {
  font-size: 0.74rem;
  color: var(--text);
  margin-top: 2px;
}
.poi-card__meta .coords {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.poi-card__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.poi-card__actions .btn-icon {
  width: 26px;
  height: 26px;
  padding: 5px;
}
.poi-card__actions .btn-icon svg {
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
