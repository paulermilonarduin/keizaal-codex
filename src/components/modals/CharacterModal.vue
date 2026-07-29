<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AvatarCropModal from './AvatarCropModal.vue'
import GroupPickerModal from './GroupPickerModal.vue'
import { RACES, RELATIONS } from '../../../shared/enums.ts'
import { avatarUrl } from '../../lib/avatarUrl.ts'
import { resizeToWebp } from '../../lib/imageResize.ts'
import { findDuplicateSuggestions } from '../../lib/duplicateSuggestions.ts'
import {
  draftFrom,
  restoredDraft,
  type CharacterDraft,
  type PlacementRestore,
} from '../../lib/characterDraft.ts'
import type { Character, CharacterInput, Group, GroupInput } from '../../../shared/schemas.ts'

// Conservé pour les composants qui importaient ce type ; la définition vit
// désormais dans lib/characterDraft.ts avec la logique de restauration (#74).
export type Draft = CharacterDraft

const props = defineProps<{
  character: Character | null
  groups: Group[]
  allCharacters: Character[]
  placementRestore: PlacementRestore | null
}>()

const emit = defineEmits<{
  close: []
  save: [{ input: CharacterInput; avatarBlob: Blob | null }]
  delete: [string]
  'create-group': [GroupInput]
  'select-existing': [string]
  place: [Draft]
}>()

// Restauration du brouillon au retour du mode placement : logique et type dans
// lib/characterDraft.ts, testables sans DOM.
const draft = ref<Draft>(restoredDraft(props.placementRestore, props.character))
const avatarPreviewUrl = ref<string | null>(null)
const pendingDelete = ref(false)
// Fichier en attente de recadrage : la modale de crop (#97) s'intercale entre
// le choix du fichier et resizeToWebp.
const cropFile = ref<File | null>(null)
// Modale de sélection des groupes (#114) : purement locale, elle ne vit que le
// temps de la fiche, sans détour par ui.store.
const pickerOpen = ref(false)

// L'aperçu est dérivé du blob du brouillon : une objectURL ne survit pas au
// démontage de la modale, contrairement au blob qui voyage avec le brouillon.
function refreshPreview(): void {
  releasePreview()
  const blob = draft.value.avatarBlob
  if (blob !== null) avatarPreviewUrl.value = URL.createObjectURL(blob)
}

function releasePreview(): void {
  if (avatarPreviewUrl.value === null) return
  URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = null
}

refreshPreview()

// Fermer la modale sans révoquer laissait fuir une objectURL (relevé dans #74).
onBeforeUnmount(releasePreview)

watch(
  () => props.character,
  (character) => {
    draft.value = draftFrom(character)
    refreshPreview()
  },
)

const isEditing = computed(() => props.character !== null)
const displayedAvatar = computed(
  () => avatarPreviewUrl.value ?? (props.character !== null ? avatarUrl(props.character) : null),
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

// Intersection avec le brouillon, pas avec `character.groups` : le bloc doit
// refléter la sélection en cours, non encore enregistrée (#114).
const draftGroups = computed(() =>
  props.groups.filter((group) => draft.value.groups.includes(group.id)),
)

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined) return
  cropFile.value = file
  // Vidé aussitôt : sans ça, rechoisir le même fichier après une annulation du
  // recadrage ne redéclencherait pas l'événement change.
  input.value = ''
}

async function onCropApplied(blob: Blob): Promise<void> {
  // Stocké dans le brouillon, pas dans une ref locale : c'est ce qui lui permet
  // de survivre à l'aller-retour vers la carte (#74).
  draft.value.avatarBlob = await resizeToWebp(blob)
  refreshPreview()
  cropFile.value = null
}

// Position éditée uniquement via la carte (mode placement, ticket #16) :
// portée par le brouillon, pas par un champ de formulaire.
function buildInput(): CharacterInput {
  return {
    name: draft.value.name.trim() === '' ? undefined : draft.value.name.trim(),
    gameId: draft.value.gameId.trim() === '' ? undefined : draft.value.gameId.trim(),
    race: draft.value.race,
    relation: draft.value.relation,
    role: draft.value.role.trim() === '' ? undefined : draft.value.role.trim(),
    note: draft.value.note.trim() === '' ? undefined : draft.value.note,
    groups: draft.value.groups,
    position: draft.value.position,
  }
}

function submit(): void {
  if (!canSave.value) return
  emit('save', { input: buildInput(), avatarBlob: draft.value.avatarBlob })
}

function placeOnMap(): void {
  emit('place', draft.value)
}

function clearPosition(): void {
  if (props.character === null) return
  draft.value.position = undefined
  emit('save', { input: buildInput(), avatarBlob: null })
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
      <!-- Seuls les groupes du personnage, en simple affichage : l'assignation
           passe par la modale de sélection (#114). -->
      <div class="group-chips">
        <span v-for="group in draftGroups" :key="group.id" class="group-chip is-on">
          <span class="dot" :style="{ background: group.color ?? 'var(--text-muted)' }" />
          {{ group.name }}
        </span>
        <span v-if="draftGroups.length === 0" class="placeholder">Aucun groupe</span>
        <button type="button" class="group-chip add" @click="pickerOpen = true">
          Gérer les groupes
        </button>
      </div>
    </div>

    <div class="position-row">
      <span>Position</span>
      <!-- Plus de libellé de lieu depuis #80 : des coordonnées en pixels
           d'image ne diraient rien, seul l'état renseigné/vide est utile. -->
      <span class="place">
        <strong v-if="draft.position">Placée sur la carte</strong>
        <span v-else class="placeholder">Non renseignée</span>
      </span>
      <div class="position-row__actions">
        <ToolbarButton label="Placer sur la carte" @click="placeOnMap()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          v-if="draft.position"
          variant="danger"
          label="Supprimer la position"
          @click="clearPosition()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
      </div>
    </div>

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

  <AvatarCropModal
    v-if="cropFile"
    :file="cropFile"
    @cancel="cropFile = null"
    @apply="onCropApplied"
  />

  <GroupPickerModal
    v-if="pickerOpen"
    :groups="groups"
    :selected-ids="draft.groups"
    @update:selected-ids="draft.groups = $event"
    @create="$emit('create-group', $event)"
    @close="pickerOpen = false"
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
  align-items: center;
  gap: 6px;
}
/* Plus un bouton depuis #114 : les chips affichent, seule celle d'ouverture du
   picker reste cliquable. */
.group-chip {
  font-size: 0.74rem;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: none;
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
  cursor: pointer;
}
/* Même discrétion que la position non renseignée. */
.group-chips .placeholder {
  font-size: 0.78rem;
  font-style: italic;
  color: var(--text-muted);
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
.position-row .place {
  flex: 1;
  min-width: 0;
}
.position-row .placeholder {
  font-style: italic;
}
.position-row__actions {
  display: flex;
  gap: 6px;
  flex: none;
}

</style>
