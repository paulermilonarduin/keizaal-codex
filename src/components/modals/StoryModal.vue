<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ModalShell from './ModalShell.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import CharacterAvatar from '../characters/CharacterAvatar.vue'
import { buildInput, draftFrom } from '../../lib/storyDraft.ts'
import { debounce } from '../../lib/debounce.ts'
import { NOTES_MAX_LENGTH } from '../../../shared/schemas.ts'
import type { Character, Group, Poi, Story, StoryInput } from '../../../shared/schemas.ts'

const SAVE_DELAY_MS = 1000

const props = defineProps<{
  story: Story | null
  allCharacters: Character[]
  allGroups: Group[]
  allPois: Poi[]
}>()

const emit = defineEmits<{
  close: []
  create: [StoryInput]
  update: [StoryInput]
  delete: [string]
}>()

// `story === null` = création : on ne demande que le titre et la date, les liens
// et les notes arrivent une fois la fiche créée (#83). Le parent remonte la
// modale (clé sur la cible) au passage en édition.
const isEditing = props.story !== null

// Brouillon local, initialisé une fois et jamais resynchronisé depuis les
// props : la réponse du PUT relue par le store renverrait ce qu'on vient de
// taper, mais avec un temps de retard, et la frappe sauterait.
const draft = ref(draftFrom(props.story))

const pendingDelete = ref(false)

const canSubmit = computed(() => draft.value.title.trim() !== '')

// Écriture pessimiste : chaque commit envoie l'histoire entière (PUT complet).
function commit(): void {
  if (!canSubmit.value) return
  emit('update', buildInput(draft.value))
}

// Un titre vide n'est pas une modification, c'est une saisie inachevée : on
// revient à la valeur du store plutôt que d'envoyer un PUT invalide.
function commitTitle(): void {
  if (draft.value.title.trim() === '') {
    draft.value.title = props.story?.title ?? ''
    return
  }
  commit()
}

// Seconde exception assumée à l'écriture pessimiste après les notes générales
// (#72) : la frappe est continue, un aller-retour par caractère n'a pas de sens.
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

const characterName = (character: Character): string =>
  character.name ?? character.gameId ?? 'Sans nom'

function byLabel<T>(items: T[], label: (item: T) => string): T[] {
  return [...items].sort((a, b) => label(a).localeCompare(label(b), 'fr'))
}

const linkedCharacters = computed(() =>
  props.allCharacters.filter((character) => draft.value.characters.includes(character.id)),
)
const linkedGroups = computed(() =>
  props.allGroups.filter((group) => draft.value.groups.includes(group.id)),
)
const linkedPois = computed(() => props.allPois.filter((poi) => draft.value.pois.includes(poi.id)))

const availableCharacters = computed(() =>
  byLabel(
    props.allCharacters.filter((character) => !draft.value.characters.includes(character.id)),
    characterName,
  ),
)
const availableGroups = computed(() =>
  byLabel(
    props.allGroups.filter((group) => !draft.value.groups.includes(group.id)),
    (group) => group.name,
  ),
)
const availablePois = computed(() =>
  byLabel(
    props.allPois.filter((poi) => !draft.value.pois.includes(poi.id)),
    (poi) => poi.name,
  ),
)

// Ajout et retrait sont des mutations franches : ils partent tout de suite,
// contrairement aux notes.
function link(list: 'characters' | 'groups' | 'pois', id: string): void {
  if (id === '' || draft.value[list].includes(id)) return
  draft.value[list].push(id)
  commit()
}

function unlink(list: 'characters' | 'groups' | 'pois', id: string): void {
  draft.value[list] = draft.value[list].filter((linked) => linked !== id)
  commit()
}
</script>

<template>
  <ModalShell wide @close="close">
    <template #title>{{ isEditing ? 'Histoire' : 'Nouvelle histoire' }}</template>

    <!-- Création : une seule colonne, le strict nécessaire. -->
    <div v-if="!isEditing" class="story-create">
      <div class="field">
        <label for="storyTitle">Titre</label>
        <input
          id="storyTitle"
          v-model="draft.title"
          type="text"
          autofocus
          @keydown.enter.prevent="submitCreation"
        />
      </div>
      <div class="field">
        <label for="storyDate">Date</label>
        <input id="storyDate" v-model="draft.date" type="date" />
      </div>
    </div>

    <!-- Édition : deux colonnes, liens à gauche, notes à droite (maquette #83). -->
    <div v-else class="story-body">
      <div class="story-side">
        <div class="field">
          <label for="storyTitle">Titre</label>
          <input
            id="storyTitle"
            v-model="draft.title"
            type="text"
            @blur="commitTitle"
            @keydown.enter.prevent="commitTitle"
          />
        </div>
        <div class="field">
          <label for="storyDate">Date</label>
          <input id="storyDate" v-model="draft.date" type="date" @change="commit" />
        </div>

        <section class="links">
          <h3>Personnages</h3>
          <div v-if="linkedCharacters.length > 0" class="avatars">
            <!-- Pastille ronde partagée : composant CharacterAvatar. -->
            <div v-for="character in linkedCharacters" :key="character.id" class="avatar-item">
              <CharacterAvatar :character="character" :title="characterName(character)" />
              <button
                type="button"
                class="unlink"
                :aria-label="`Retirer ${characterName(character)}`"
                @click="unlink('characters', character.id)"
              >
                ×
              </button>
            </div>
          </div>
          <select
            aria-label="Lier un personnage"
            :value="''"
            @change="link('characters', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Lier un personnage…</option>
            <option v-for="character in availableCharacters" :key="character.id" :value="character.id">
              {{ characterName(character) }}
            </option>
          </select>
        </section>

        <section class="links">
          <h3>Groupes</h3>
          <div v-for="group in linkedGroups" :key="group.id" class="group-row">
            <span class="group-swatch" :style="{ background: group.color ?? 'transparent' }" />
            <span class="group-name">{{ group.name }}</span>
            <button
              type="button"
              class="unlink"
              :aria-label="`Retirer ${group.name}`"
              @click="unlink('groups', group.id)"
            >
              ×
            </button>
          </div>
          <select
            aria-label="Lier un groupe"
            :value="''"
            @change="link('groups', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Lier un groupe…</option>
            <option v-for="group in availableGroups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </section>

        <section class="links">
          <h3>Lieux</h3>
          <ul v-if="linkedPois.length > 0" class="poi-list">
            <li v-for="poi in linkedPois" :key="poi.id">
              <span class="bullet">-</span>
              <span class="poi-name">{{ poi.name }}</span>
              <button
                type="button"
                class="unlink"
                :aria-label="`Retirer ${poi.name}`"
                @click="unlink('pois', poi.id)"
              >
                ×
              </button>
            </li>
          </ul>
          <select
            aria-label="Lier un lieu"
            :value="''"
            @change="link('pois', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Lier un lieu…</option>
            <option v-for="poi in availablePois" :key="poi.id" :value="poi.id">
              {{ poi.name }}
            </option>
          </select>
        </section>
      </div>

      <!-- Textarea non contrôlé (:value + @input) : la valeur relue du store
           arrive après le PUT et remettrait le curseur en fin de champ. -->
      <div class="story-notes">
        <label for="storyNotes">Notes</label>
        <textarea
          id="storyNotes"
          :value="draft.notes"
          :maxlength="NOTES_MAX_LENGTH"
          placeholder="Ce qui s'est passé, qui était là, ce qu'il reste à éclaircir…"
          spellcheck="false"
          @input="onNotesInput"
        />
      </div>
    </div>

    <template #footer>
      <ToolbarButton
        v-if="isEditing"
        variant="danger"
        label="Supprimer cette histoire"
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
        <ToolbarButton v-if="isEditing" variant="primary" label="Terminé" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
        <ToolbarButton v-else label="Fermer" @click="close">
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
       (même raison que dans GroupsList). -->
  <Teleport to="body">
    <ConfirmDialog
      v-if="pendingDelete && story"
      title="Supprimer l'histoire"
      :message="`Supprimer « ${story.title} » ? Les personnages, groupes et lieux liés ne seront pas supprimés.`"
      @confirm="
        () => {
          pendingDelete = false
          $emit('delete', story!.id)
        }
      "
      @cancel="pendingDelete = false"
    />
  </Teleport>
</template>

<style scoped>
.story-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Colonne gauche à largeur fixe, notes prenant tout le reste : c'est la
   maquette validée de l'issue #83. */
.story-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 18px;
  align-items: stretch;
}
@media (max-width: 760px) {
  .story-body {
    grid-template-columns: 1fr;
  }
}

.story-side {
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
.story-notes label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.field input,
.links select {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 0.86rem;
  color: var(--text);
  min-width: 0;
}
.field input:focus,
.links select:focus {
  border-color: var(--accent-dim);
  outline: none;
}

.links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.links h3 {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-weight: 400;
}

.avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.avatar-item {
  position: relative;
}
.unlink {
  background: var(--bg);
  color: var(--rel-ennemi);
  border: 1px solid var(--border);
  border-radius: 999px;
  width: 18px;
  height: 18px;
  line-height: 1;
  padding: 0;
  font-size: 0.8rem;
  cursor: pointer;
}
.unlink:hover {
  border-color: var(--border-strong);
}
.avatar-item .unlink {
  position: absolute;
  top: -4px;
  right: -4px;
}

.group-row .group-swatch {
  cursor: default;
}
.group-row .group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.poi-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  color: var(--text);
  min-width: 0;
}
.poi-list .bullet {
  color: var(--text-muted);
}
.poi-list .poi-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-notes {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.story-notes textarea {
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
.story-notes textarea:focus {
  border-color: var(--accent-dim);
  outline: none;
}
.story-notes textarea::placeholder {
  color: var(--text-muted);
}

.right {
  display: flex;
  gap: 8px;
}
</style>
