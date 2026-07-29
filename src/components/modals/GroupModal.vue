<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ModalShell from './ModalShell.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import { buildInput, draftFrom } from '../../lib/groupDraft.ts'
import { debounce } from '../../lib/debounce.ts'
import { NOTES_MAX_LENGTH } from '../../../shared/schemas.ts'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

const SAVE_DELAY_MS = 1000

const props = defineProps<{ group: Group | null }>()

const emit = defineEmits<{
  close: []
  create: [GroupInput]
  update: [GroupInput]
  delete: [string]
}>()

// `group === null` = création : on ne demande que le nom et la couleur, la
// description et les notes arrivent une fois la fiche créée (#113). Le parent
// remonte la modale (clé sur la cible) au passage en édition.
const isEditing = props.group !== null

// Brouillon local, initialisé une fois et jamais resynchronisé depuis les
// props : la réponse du PUT relue par le store renverrait ce qu'on vient de
// taper, mais avec un temps de retard, et la frappe sauterait.
const draft = ref(draftFrom(props.group))

const pendingDelete = ref(false)

const canSubmit = computed(() => draft.value.name.trim() !== '')

// Écriture pessimiste : chaque commit envoie le groupe entier (PUT complet).
function commit(): void {
  if (!canSubmit.value) return
  emit('update', buildInput(draft.value))
}

// Un nom vide n'est pas une modification, c'est une saisie inachevée : on
// revient à la valeur du store plutôt que d'envoyer un PUT invalide.
function commitName(): void {
  if (draft.value.name.trim() === '') {
    draft.value.name = props.group?.name ?? ''
    return
  }
  commit()
}

// Troisième exception assumée à l'écriture pessimiste, après les notes
// générales (#72) et les notes d'histoire (#83) : la frappe est continue, un
// aller-retour par caractère n'a pas de sens.
const scheduleSave = debounce<[]>(() => commit(), SAVE_DELAY_MS)

function onNotesInput(event: Event): void {
  draft.value.notes = (event.target as HTMLTextAreaElement).value
  scheduleSave()
}

// Pas de keepalive comme NotesPanel : la modale ne survit pas à la fermeture de
// l'application, mais une frappe en attente ne doit pas se perdre en la fermant.
function close(): void {
  scheduleSave.flush()
  emit('close')
}
onBeforeUnmount(() => scheduleSave.flush())

function submitCreation(): void {
  if (!canSubmit.value) return
  emit('create', buildInput(draft.value))
}
</script>

<template>
  <ModalShell wide @close="close">
    <template #title>{{ isEditing ? 'Groupe' : 'Nouveau groupe' }}</template>

    <!-- Création : une seule colonne, le strict nécessaire. -->
    <div v-if="!isEditing" class="group-create">
      <div class="field">
        <label for="groupName">Nom</label>
        <input
          id="groupName"
          v-model="draft.name"
          type="text"
          autofocus
          @keydown.enter.prevent="submitCreation"
        />
      </div>
      <div class="field">
        <label for="groupColor">Couleur</label>
        <input id="groupColor" v-model="draft.color" type="color" class="color-input" />
      </div>
    </div>

    <!-- Édition : deux colonnes, identité à gauche, notes à droite (même
         maquette que la modale des histoires). -->
    <div v-else class="group-body">
      <div class="group-side">
        <div class="field">
          <label for="groupName">Nom</label>
          <input
            id="groupName"
            v-model="draft.name"
            type="text"
            @blur="commitName"
            @keydown.enter.prevent="commitName"
          />
        </div>
        <div class="field">
          <label for="groupColor">Couleur</label>
          <input
            id="groupColor"
            v-model="draft.color"
            type="color"
            class="color-input"
            @change="commit"
          />
        </div>
        <div class="field">
          <label for="groupDescription">Description</label>
          <input
            id="groupDescription"
            v-model="draft.description"
            type="text"
            placeholder="En une ligne…"
            @change="commit"
          />
        </div>
      </div>

      <!-- Textarea non contrôlé (:value + @input) : la valeur relue du store
           arrive après le PUT et remettrait le curseur en fin de champ. -->
      <div class="group-notes">
        <label for="groupNotes">Notes</label>
        <textarea
          id="groupNotes"
          :value="draft.notes"
          :maxlength="NOTES_MAX_LENGTH"
          placeholder="Ce que fait ce groupe, qui le mène, ce qu'il reste à éclaircir…"
          spellcheck="false"
          @input="onNotesInput"
        />
      </div>
    </div>

    <template #footer>
      <ToolbarButton
        v-if="isEditing"
        variant="danger"
        label="Supprimer ce groupe"
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
        <ToolbarButton label="Fermer" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          v-if="!isEditing"
          variant="primary"
          label="Créer"
          :disabled="!canSubmit"
          @click="submitCreation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>

  <!-- Teleport indispensable : le backdrop-filter de .modal-overlay crée un bloc
       conteneur, le position: fixed de la confirmation s'y retrouverait piégé
       (même raison que dans StoryModal et GroupsList). -->
  <Teleport to="body">
    <ConfirmDialog
      v-if="pendingDelete && group"
      title="Supprimer le groupe"
      :message="`Supprimer « ${group.name} » ? Les personnages qui en font partie ne seront pas supprimés.`"
      @confirm="
        () => {
          pendingDelete = false
          $emit('delete', group!.id)
        }
      "
      @cancel="pendingDelete = false"
    />
  </Teleport>
</template>

<style scoped>
.group-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Colonne gauche à largeur fixe, notes prenant tout le reste : même maquette
   que la modale des histoires (#83). */
.group-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 18px;
  align-items: stretch;
}
@media (max-width: 760px) {
  .group-body {
    grid-template-columns: 1fr;
  }
}

.group-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field label,
.group-notes label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.field input {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 0.86rem;
  color: var(--text);
  min-width: 0;
}
.field input:focus {
  border-color: var(--accent-dim);
  outline: none;
}
/* Un input color n'a pas de texte : la hauteur vient du padding ailleurs, ici
   elle doit être posée, et la pastille occupe toute la case. */
.field .color-input {
  padding: 2px;
  height: 34px;
  cursor: pointer;
}
.field input::placeholder {
  color: var(--text-muted);
}

.group-notes {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.group-notes textarea {
  flex: 1 1 auto;
  min-height: 360px;
  resize: vertical;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-family: inherit;
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--text);
}
.group-notes textarea:focus {
  border-color: var(--accent-dim);
  outline: none;
}
.group-notes textarea::placeholder {
  color: var(--text-muted);
}

.right {
  display: flex;
  gap: 8px;
}
</style>
