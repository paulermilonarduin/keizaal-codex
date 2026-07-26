<script setup lang="ts">
import { ref } from 'vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import ConfirmDialog from '../modals/ConfirmDialog.vue'
import { groupInputFrom } from '../../lib/groupInput.ts'
import type { Group, GroupInput } from '../../../shared/schemas.ts'

// Liste éditable partagée par la modale Groupes et l'onglet Groupes (#53) :
// l'édition inline couleur/nom et la suppression confirmée ne vivent qu'ici.
// Elle reçoit les groupes déjà filtrés — c'est au parent de décider s'il y a une
// recherche (la modale n'en a pas) et quoi afficher quand la liste est vide.
// `withDescription` (#63) n'est activé que par l'onglet : la modale, plus
// étroite, garde ses lignes compactes.
withDefaults(defineProps<{ groups: Group[]; withDescription?: boolean }>(), {
  withDescription: false,
})

const emit = defineEmits<{ update: [string, GroupInput]; remove: [string] }>()

const pendingDelete = ref<Group | null>(null)

// Un renommage vide ou identique n'est pas une modification : on évite l'appel
// serveur (écriture pessimiste, ARCHITECTURE.md §5.2).
function renameGroup(group: Group, name: string): void {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === group.name) return
  emit('update', group.id, groupInputFrom(group, { name: trimmed }))
}

function recolorGroup(group: Group, color: string): void {
  emit('update', group.id, groupInputFrom(group, { color }))
}

// Contrairement au nom, une description peut légitimement être vidée : seule
// l'absence de changement est ignorée (groupInputFrom traduit '' en undefined).
function describeGroup(group: Group, description: string): void {
  if (description.trim() === (group.description ?? '')) return
  emit('update', group.id, groupInputFrom(group, { description }))
}

function confirmDelete(): void {
  if (pendingDelete.value === null) return
  emit('remove', pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <ul class="group-list">
    <li v-for="group in groups" :key="group.id" class="group-item">
      <div class="group-row">
        <input
          type="color"
          class="group-swatch"
          aria-label="Couleur du groupe"
          :value="group.color ?? '#d9b54a'"
          @change="recolorGroup(group, ($event.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          class="group-name"
          aria-label="Nom du groupe"
          :value="group.name"
          @change="renameGroup(group, ($event.target as HTMLInputElement).value)"
        />
        <ToolbarButton variant="danger" label="Supprimer" @click="pendingDelete = group">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13h10l1-13" />
          </svg>
        </ToolbarButton>
      </div>
      <input
        v-if="withDescription"
        type="text"
        class="group-description"
        placeholder="Description…"
        :aria-label="`Description du groupe ${group.name}`"
        :value="group.description ?? ''"
        @change="describeGroup(group, ($event.target as HTMLInputElement).value)"
      />
    </li>
  </ul>

  <!-- Teleport indispensable : utilisée depuis la modale Groupes, cette liste
       est un descendant de .modal-overlay, dont le backdrop-filter crée un bloc
       conteneur — le position: fixed de la confirmation s'y retrouverait piégé,
       centré sur l'overlay au lieu de l'écran. -->
  <Teleport to="body">
    <ConfirmDialog
      v-if="pendingDelete"
      title="Supprimer le groupe"
      :message="`Supprimer « ${pendingDelete.name} » ? Les personnages qui en font partie ne seront pas supprimés.`"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </Teleport>
</template>

<style scoped>
.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* La description passe sous la ligne couleur/nom/suppression plutôt qu'à côté :
   elle a besoin de largeur, et la sidebar n'en a que 340px (#63). */
.group-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
/* Même habillage que .group-name (theme.css) mais discret et pleine largeur —
   pas la classe elle-même : son `flex: 1` s'appliquerait ici à la hauteur. */
.group-description {
  /* Pas de width : l'étirement du flex column suffit, et une largeur explicite
     déborderait de la marge d'alignement ci-dessous. */
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 9px;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-left: 36px;
}
.group-description:focus {
  border-color: var(--accent-dim);
  color: var(--text);
  outline: none;
}
</style>
