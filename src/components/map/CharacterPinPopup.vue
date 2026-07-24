<script setup lang="ts">
import { computed } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import type { Character } from '../../../shared/schemas.ts'

const props = defineProps<{ character: Character }>()

defineEmits<{ open: [string]; close: [] }>()

const displayName = computed(() => props.character.name ?? props.character.gameId ?? '')
const secondaryId = computed(() =>
  props.character.name !== undefined ? props.character.gameId : undefined,
)
const metaLine = computed(() =>
  [props.character.race, props.character.role].filter(Boolean).join(' · '),
)
</script>

<template>
  <div class="pin-popup" :class="`pin-popup--${character.relation}`">
    <ToolbarButton variant="ghost" label="Fermer" class="pin-popup__close" @click="$emit('close')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </ToolbarButton>

    <img v-if="character.avatar" class="avatar" :src="`/${character.avatar}`" alt="" />
    <div v-else class="avatar unknown">?</div>

    <div class="pin-popup__body">
      <div class="pin-popup__name">
        {{ displayName }}
        <span v-if="secondaryId" class="gid">{{ secondaryId }}</span>
      </div>
      <div class="pin-popup__meta">{{ metaLine }}</div>
    </div>

    <div class="pin-popup__footer">
      <ToolbarButton variant="primary" label="Ouvrir la fiche" @click="$emit('open', character.id)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </ToolbarButton>
    </div>
  </div>
</template>

<style scoped>
.pin-popup {
  position: absolute;
  z-index: 15;
  width: 240px;
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 10px;
  align-items: start;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.pin-popup::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}
.pin-popup--ami::before {
  background: var(--rel-ami);
}
.pin-popup--neutre::before {
  background: var(--rel-neutre);
}
.pin-popup--ennemi::before {
  background: var(--rel-ennemi);
}
.pin-popup--inconnu::before {
  background: var(--rel-inconnu);
}

.pin-popup__close {
  position: absolute;
  top: 6px;
  right: 6px;
}

.avatar {
  width: 42px;
  height: 42px;
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

.pin-popup__body {
  min-width: 0;
  padding-right: 22px;
}
.pin-popup__name {
  font-size: 0.92rem;
  color: var(--accent);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.pin-popup__name .gid {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent-soft);
}
.pin-popup__meta {
  font-size: 0.76rem;
  color: var(--text);
  margin-top: 2px;
}

.pin-popup__footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}
</style>
