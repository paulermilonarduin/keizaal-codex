<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { RACES, RELATIONS } from '../../../shared/enums.ts'
import { resizeToWebp } from '../../lib/imageResize.ts'
import { findDuplicateSuggestions } from '../../lib/duplicateSuggestions.ts'
import { formatShortDate } from '../../lib/text.ts'
import type { Character, CharacterInput, Group } from '../../../shared/schemas.ts'

const props = defineProps<{
  character: Character | null
  groups: Group[]
  allCharacters: Character[]
}>()

const emit = defineEmits<{
  close: []
  save: [{ input: CharacterInput; avatarBlob: Blob | null }]
  delete: [string]
  'open-groups': []
  'select-existing': [string]
}>()

type Draft = {
  name: string
  gameId: string
  race: CharacterInput['race']
  relation: CharacterInput['relation']
  role: string
  note: string
  groups: string[]
}

function draftFrom(character: Character | null): Draft {
  return {
    name: character?.name ?? '',
    gameId: character?.gameId ?? '',
    race: character?.race ?? 'Inconnue',
    relation: character?.relation ?? 'inconnu',
    role: character?.role ?? '',
    note: character?.note ?? '',
    groups: character?.groups ?? [],
  }
}

const draft = ref<Draft>(draftFrom(props.character))
const avatarBlob = ref<Blob | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const pendingDelete = ref(false)

watch(
  () => props.character,
  (character) => {
    draft.value = draftFrom(character)
    avatarBlob.value = null
    avatarPreviewUrl.value = null
  },
)

const isEditing = computed(() => props.character !== null)
const displayedAvatar = computed(
  () => avatarPreviewUrl.value ?? (props.character?.avatar ? `/${props.character.avatar}` : null),
)
const canSave = computed(() => draft.value.name.trim() !== '' || draft.value.gameId.trim() !== '')

const duplicateSuggestions = computed(() => {
  if (isEditing.value) return []
  return findDuplicateSuggestions(props.allCharacters, {
    name: draft.value.name,
    gameId: draft.value.gameId,
  })
})

function suggestionLabel(character: Character): string {
  const parts = [character.name, character.gameId].filter((value): value is string => Boolean(value))
  return parts.join(' ')
}

function toggleGroup(groupId: string): void {
  const index = draft.value.groups.indexOf(groupId)
  if (index === -1) draft.value.groups.push(groupId)
  else draft.value.groups.splice(index, 1)
}

async function onFilePicked(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file === undefined) return
  const blob = await resizeToWebp(file)
  if (avatarPreviewUrl.value !== null) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarBlob.value = blob
  avatarPreviewUrl.value = URL.createObjectURL(blob)
}

// Positions absentes du formulaire (édité uniquement via la carte, ticket
// #16) : préservées telles quelles, sauf override explicite (suppression).
function buildInput(positions: {
  homePosition?: CharacterInput['homePosition']
  knownPosition?: CharacterInput['knownPosition']
} = {}): CharacterInput {
  return {
    name: draft.value.name.trim() === '' ? undefined : draft.value.name.trim(),
    gameId: draft.value.gameId.trim() === '' ? undefined : draft.value.gameId.trim(),
    race: draft.value.race,
    relation: draft.value.relation,
    role: draft.value.role.trim() === '' ? undefined : draft.value.role.trim(),
    note: draft.value.note.trim() === '' ? undefined : draft.value.note,
    groups: draft.value.groups,
    homePosition: 'homePosition' in positions ? positions.homePosition : props.character?.homePosition,
    knownPosition:
      'knownPosition' in positions ? positions.knownPosition : props.character?.knownPosition,
  }
}

function submit(): void {
  if (!canSave.value) return
  emit('save', { input: buildInput(), avatarBlob: avatarBlob.value })
}

function clearPosition(kind: 'home' | 'known'): void {
  if (props.character === null) return
  const input =
    kind === 'home' ? buildInput({ homePosition: undefined }) : buildInput({ knownPosition: undefined })
  emit('save', { input, avatarBlob: null })
}
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>{{ isEditing ? (character?.name ?? character?.gameId) : 'Nouveau personnage' }}</template>

    <div class="avatar-upload">
      <label class="drop" for="avatarInput">
        <img v-if="displayedAvatar" class="avatar-preview" :src="displayedAvatar" alt="" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7l1.6-2.4h4.8L16 7" />
          <circle cx="12" cy="13.5" r="3.4" />
        </svg>
      </label>
      <input id="avatarInput" type="file" accept="image/*" class="visually-hidden" @change="onFilePicked" />
    </div>

    <div class="field-row">
      <div class="field">
        <label for="fieldName">Nom</label>
        <input id="fieldName" v-model="draft.name" type="text" />
      </div>
      <div class="field">
        <label for="fieldGameId">#ID</label>
        <input id="fieldGameId" v-model="draft.gameId" type="text" placeholder="#XXXXX" />
      </div>
    </div>

    <ul v-if="duplicateSuggestions.length > 0" class="suggestions">
      <li
        v-for="suggestion in duplicateSuggestions"
        :key="suggestion.id"
        @click="$emit('select-existing', suggestion.id)"
      >
        {{ suggestionLabel(suggestion) }}
      </li>
    </ul>

    <div class="field-row">
      <div class="field">
        <label for="fieldRace">Race</label>
        <select id="fieldRace" v-model="draft.race">
          <option v-for="race in RACES" :key="race" :value="race">{{ race }}</option>
        </select>
      </div>
      <div class="field">
        <label for="fieldRole">Rôle</label>
        <input id="fieldRole" v-model="draft.role" type="text" />
      </div>
    </div>

    <div class="field">
      <label>Relation</label>
      <div class="segmented">
        <button
          v-for="relation in RELATIONS"
          :key="relation"
          type="button"
          :class="{ 'is-selected': draft.relation === relation }"
          :data-rel="relation"
          @click="draft.relation = relation"
        >
          {{ relation }}
        </button>
      </div>
    </div>

    <div class="field">
      <label>Groupes</label>
      <div class="group-chips">
        <span
          v-for="group in groups"
          :key="group.id"
          class="group-chip"
          :class="{ 'is-on': draft.groups.includes(group.id) }"
          @click="toggleGroup(group.id)"
        >
          <span class="dot" :style="{ background: group.color ?? 'var(--text-muted)' }" />
          {{ group.name }}
        </span>
        <span class="group-chip add" @click="$emit('open-groups')">+ groupe</span>
      </div>
    </div>

    <template v-if="isEditing">
      <div v-if="character?.homePosition" class="position-row">
        <span>Position générale</span>
        <span class="place"
          ><strong>{{ character.homePosition.label ?? 'Position' }}</strong></span
        >
        <ToolbarButton variant="danger" label="Supprimer cette position" @click="clearPosition('home')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
      </div>
      <div v-if="character?.knownPosition" class="position-row">
        <span>Dernière position connue</span>
        <span class="place"
          ><strong>{{ character.knownPosition.label ?? 'Position' }}</strong>
          <template v-if="character.knownPosition.date"> — {{ formatShortDate(character.knownPosition.date) }}</template>
        </span>
        <ToolbarButton variant="danger" label="Supprimer cette position" @click="clearPosition('known')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
      </div>
    </template>

    <div class="field">
      <label for="fieldNote">Note</label>
      <textarea id="fieldNote" v-model="draft.note" />
    </div>

    <template #footer>
      <ToolbarButton
        v-if="isEditing"
        variant="danger"
        label="Supprimer la fiche"
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
        <ToolbarButton variant="primary" label="Enregistrer" :disabled="!canSave" @click="submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>

  <ConfirmDialog
    v-if="pendingDelete && character"
    title="Supprimer la fiche"
    :message="`Supprimer la fiche de ${character.name ?? character.gameId} ? Cette action est irréversible.`"
    @confirm="
      () => {
        $emit('delete', character!.id)
        pendingDelete = false
      }
    "
    @cancel="pendingDelete = false"
  />
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.avatar-upload {
  display: flex;
  justify-content: center;
}
.drop {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 2px dashed var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  overflow: hidden;
}
.drop svg {
  width: 20px;
  height: 20px;
}
.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

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
.field select,
.field textarea {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 0.86rem;
  color: var(--text);
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--accent-dim);
  outline: none;
}
.field textarea {
  resize: vertical;
  min-height: 60px;
  font-family: var(--font-body);
}
.field-row {
  display: flex;
  gap: 12px;
}
.field-row .field {
  flex: 1;
}

.suggestions {
  margin: -6px 0 0;
  padding: 4px;
  background: var(--card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  list-style: none;
  font-size: 0.82rem;
}
.suggestions li {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text);
}
.suggestions li:hover {
  background: var(--accent);
  color: #14161b;
}

.segmented {
  display: flex;
  gap: 6px;
}
.segmented button {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 4px;
  font-size: 0.76rem;
  cursor: pointer;
  color: var(--text-muted);
}
.segmented button.is-selected {
  color: #14161b;
  font-weight: 600;
}
.segmented button[data-rel='ami'].is-selected {
  background: var(--rel-ami);
  border-color: var(--rel-ami);
}
.segmented button[data-rel='neutre'].is-selected {
  background: var(--rel-neutre);
  border-color: var(--rel-neutre);
}
.segmented button[data-rel='ennemi'].is-selected {
  background: var(--rel-ennemi);
  border-color: var(--rel-ennemi);
  color: #fff;
}
.segmented button[data-rel='inconnu'].is-selected {
  background: var(--rel-inconnu);
  border-color: var(--rel-inconnu);
}

.group-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.group-chip {
  font-size: 0.74rem;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  cursor: pointer;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.group-chip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.group-chip.is-on {
  color: var(--text);
  background: color-mix(in srgb, var(--bg) 78%, white 22%);
}
.group-chip.add {
  border-style: dashed;
}

.position-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}
.position-row .place {
  color: var(--text-muted);
}
.position-row .place strong {
  color: var(--text);
  font-weight: 600;
}

.right {
  display: flex;
  gap: 8px;
}
</style>
