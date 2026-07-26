<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { NOTES_MAX_LENGTH } from '../../../shared/schemas.ts'
import { debounce } from '../../lib/debounce.ts'
import { useNotesStore } from '../../stores/notes.store.ts'

const SAVE_DELAY_MS = 1000

const notes = useNotesStore()

const emit = defineEmits<{ error: [unknown] }>()

// La remontée d'erreur passe par App.vue comme partout ailleurs
// (ARCHITECTURE.md §5.3) ; ici elle est d'autant plus utile qu'un échec
// silencieux ferait croire à une note enregistrée.
const scheduleSave = debounce<[]>(() => {
  void notes.save().catch((error: unknown) => emit('error', error))
}, SAVE_DELAY_MS)

function onInput(event: Event): void {
  notes.text = (event.target as HTMLTextAreaElement).value
  notes.markDirty()
  scheduleSave()
}

// Fermer l'application dans la seconde qui suit une frappe ne doit pas perdre la
// saisie. On n'utilise pas flush() ici : il rejouerait l'appel tel qu'il a été
// programmé, sans pouvoir signaler la fermeture — or c'est justement ce qui
// décide du mode keepalive, seul moyen qu'une requête survive à la fermeture de
// la fenêtre (Electron déclenche beforeunload en fermant).
function saveBeforeClosing(): void {
  scheduleSave.cancel()
  if (!notes.dirty) return
  void notes.save({ closing: true }).catch(() => {
    // La fenêtre disparaît : afficher une erreur n'aurait aucun sens.
  })
}

onMounted(() => window.addEventListener('beforeunload', saveBeforeClosing))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', saveBeforeClosing)
  saveBeforeClosing()
})

// Exposé pour qu'App.vue puisse annuler une écriture en attente avant un
// import : sinon elle écraserait les notes fraîchement importées.
defineExpose({ cancelPendingSave: () => scheduleSave.cancel() })

const status = computed(() => {
  if (notes.saving) return 'Enregistrement…'
  if (notes.dirty) return 'Modifié'
  return 'Enregistré'
})
</script>

<template>
  <aside class="notes">
    <div class="notes__header">
      <h2>Notes générales</h2>
      <span class="notes__status" :class="{ 'is-pending': notes.dirty || notes.saving }">
        {{ status }}
      </span>
    </div>
    <textarea
      class="notes__field"
      :value="notes.text"
      :maxlength="NOTES_MAX_LENGTH"
      placeholder="Tout ce qui ne tient pas dans une fiche : rumeurs, à faire, questions en suspens…"
      aria-label="Notes générales"
      spellcheck="false"
      @input="onInput"
    />
  </aside>
</template>

<style scoped>
.notes {
  flex: 0 0 var(--notes-width);
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
  /* Au-dessus de la carte, comme la sidebar : .map-container aplatit ses panes
     Leaflet (#67) mais un z-index explicite reste plus sûr. */
  position: relative;
  z-index: 15;
}

.notes__header {
  padding: 18px 16px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.notes__header h2 {
  font-size: 0.86rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-weight: 400;
}
.notes__status {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
}
.notes__status.is-pending {
  color: var(--accent-soft);
}

.notes__field {
  flex: 1 1 auto;
  min-height: 0;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  padding: 14px 16px;
  font-family: inherit;
  font-size: 0.86rem;
  line-height: 1.55;
}
.notes__field::placeholder {
  color: var(--text-muted);
}
</style>
