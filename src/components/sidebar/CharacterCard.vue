<script setup lang="ts">
import { computed } from 'vue'
import CharacterAvatar from '../characters/CharacterAvatar.vue'
import type { Character, Group } from '../../../shared/schemas.ts'

const props = defineProps<{
  character: Character
  groups: Group[]
  highlighted?: boolean
}>()

defineEmits<{
  edit: [string]
  center: [string]
  select: [string]
  hover: [string]
  unhover: [string]
}>()

const displayName = computed(() => props.character.name ?? props.character.gameId ?? '')
const secondaryId = computed(() =>
  props.character.name !== undefined ? props.character.gameId : undefined,
)
const metaLine = computed(() =>
  [props.character.race, props.character.role].filter(Boolean).join(' · '),
)
const characterGroups = computed(() =>
  props.groups.filter((group) => props.character.groups.includes(group.id)),
)
</script>

<template>
  <article
    class="char-card"
    :class="[`char-card--${character.relation}`, { 'is-highlighted': highlighted }]"
    role="button"
    tabindex="0"
    @click="$emit('select', character.id)"
    @keydown.enter="$emit('select', character.id)"
    @keydown.space.prevent="$emit('select', character.id)"
    @mouseenter="$emit('hover', character.id)"
    @mouseleave="$emit('unhover', character.id)"
  >
    <CharacterAvatar :character="character" />

    <div class="char-card__body">
      <div class="char-card__name">
        {{ displayName }}
        <span v-if="secondaryId" class="gid">{{ secondaryId }}</span>
      </div>
      <div class="char-card__meta">{{ metaLine }}</div>
      <div v-if="characterGroups.length > 0" class="char-card__tags">
        <span v-for="group in characterGroups" :key="group.id" class="chip">{{ group.name }}</span>
      </div>
    </div>

    <div class="char-card__actions">
      <button
        type="button"
        class="btn btn-icon"
        aria-label="Modifier"
        @click.stop="$emit('edit', character.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <button
        v-if="character.position"
        type="button"
        class="btn btn-icon"
        aria-label="Centrer sur la position"
        title="Centrer la carte sur la position"
        @click.stop="$emit('center', character.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </button>
    </div>
  </article>
</template>

<style scoped>
.char-card {
  position: relative;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 10px 10px 16px;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 10px;
  align-items: start;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    transform 0.12s ease;
}
.char-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
.char-card--ami::before {
  background: var(--rel-ami);
}
.char-card--neutre::before {
  background: var(--rel-neutre);
}
.char-card--ennemi::before {
  background: var(--rel-ennemi);
}
.char-card--inconnu::before {
  background: var(--rel-inconnu);
}
.char-card:hover,
.char-card.is-highlighted {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.char-card__body {
  min-width: 0;
}
.char-card__name {
  font-size: 0.96rem;
  color: var(--accent);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.char-card__name .gid {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent-soft);
}
.char-card__meta {
  font-size: 0.76rem;
  color: var(--text);
  margin-top: 2px;
}
.char-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.chip {
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text);
}

.char-card__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
.char-card__actions .btn-icon {
  width: 26px;
  height: 26px;
  padding: 5px;
}
.char-card__actions .btn-icon svg {
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
</style>
