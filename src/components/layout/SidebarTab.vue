<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TabMove } from '../../lib/sidebarTabs.ts'

const props = defineProps<{ tabId: string; label: string; selected: boolean }>()

const emit = defineEmits<{ select: []; navigate: [TabMove] }>()

const button = ref<HTMLButtonElement | null>(null)

// Pattern ARIA « tabs » à activation automatique : le focus doit accompagner
// l'onglet sélectionné, sinon les flèches le laissent sur l'onglet de départ
// (qui vient de passer en tabindex="-1") et le focus visible ment.
// La garde sur la tablist évite de voler le focus quand la sélection change
// sans intervention clavier — un clic sur un pin de la carte force l'onglet
// Personnages (ui.store selectPin) alors que le focus est ailleurs.
watch(
  () => props.selected,
  (selected) => {
    const el = button.value
    if (!selected || el === null) return
    const focused = document.activeElement
    if (focused === null || el.parentElement?.contains(focused) !== true) return
    el.focus()
  },
  { flush: 'post' },
)

// Le composant reste bête : il ne connaît ni le store ni la liste des onglets,
// il remonte une intention de navigation (la logique vit dans sidebarTabs.ts).
const MOVES: Record<string, TabMove> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
}

function onKeydown(event: KeyboardEvent): void {
  const move = MOVES[event.key]
  if (move === undefined) return
  event.preventDefault()
  emit('navigate', move)
}
</script>

<template>
  <button
    :id="`sidebar-tab-${tabId}`"
    ref="button"
    type="button"
    class="sidebar-tab"
    role="tab"
    :aria-selected="selected"
    :aria-controls="selected ? `sidebar-panel-${tabId}` : undefined"
    :tabindex="selected ? 0 : -1"
    @click="emit('select')"
    @keydown="onKeydown"
  >
    {{ label }}
  </button>
</template>

<style scoped>
/* writing-mode vertical échange les axes physiques : uniquement des propriétés
   logiques (padding-block/inline), sinon toute retouche future est illisible. */
.sidebar-tab {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  white-space: nowrap;
  padding-block: 14px;
  padding-inline: 7px;
  background: var(--panel);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}
.sidebar-tab:hover {
  color: var(--text);
}
/* L'onglet actif se fond avec le panneau : doré, et une ombre côté carte pour
   le détacher comme un intercalaire tiré vers l'avant. */
.sidebar-tab[aria-selected='true'] {
  color: var(--accent);
  border-color: var(--border-strong);
  box-shadow: 3px 0 12px rgba(0, 0, 0, 0.3);
}
</style>
