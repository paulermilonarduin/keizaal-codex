<script setup lang="ts">
import SidebarTab from './SidebarTab.vue'
import SidebarActions from './SidebarActions.vue'
import {
  SIDEBAR_TABS,
  SIDEBAR_TAB_LABELS,
  nextTab,
  type SidebarTab as SidebarTabId,
  type TabMove,
} from '../../lib/sidebarTabs.ts'

const props = defineProps<{
  version: string
  activeTab: SidebarTabId
  poiEditMode: boolean
  // Version disponible sur GitHub, null quand il n'y a rien à signaler (#94).
  updateVersion: string | null
  checkState: 'idle' | 'checking' | 'upToDate'
}>()

const emit = defineEmits<{
  'select-tab': [SidebarTabId]
  'new-character': []
  'new-group': []
  'new-poi': []
  'new-story': []
  'check-updates': []
  'open-update': []
}>()

function onNavigate(move: TabMove): void {
  emit('select-tab', nextTab(props.activeTab, move))
}
</script>

<template>
  <!-- Le dock ne clippe pas : c'est lui qui laisse les intercalaires verticaux
       déborder sur la carte, alors que .sidebar garde son overflow: hidden
       pour le scroll de la liste. -->
  <div class="sidebar-dock">
    <nav
      class="sidebar-tabs"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Sections de la liste"
    >
      <SidebarTab
        v-for="tab in SIDEBAR_TABS"
        :key="tab"
        :tab-id="tab"
        :label="SIDEBAR_TAB_LABELS[tab]"
        :selected="tab === activeTab"
        @select="emit('select-tab', tab)"
        @navigate="onNavigate"
      />
    </nav>

    <aside class="sidebar">
      <div class="sidebar__header">
        <!-- Le logo lui-même (public/icon.svg), pas une redite de son tracé :
             une seule source pour la marque, partagée avec le favicon. C'est
             donc une image et non un SVG inline, la tuile portant ses propres
             couleurs il n'y a rien à teinter par `currentColor`. -->
        <span class="brand-mark">
          <img src="/icon.svg" alt="" width="28" height="28" />
        </span>
        <div class="brand-text">
          <h1>
            Codex Keizaal
            <!-- Le numéro de version est le déclencheur du check manuel : c'est
                 là que l'utilisateur regarde quand il se demande s'il est à
                 jour, pas besoin d'un bouton de plus (#94). -->
            <button
              type="button"
              class="version"
              title="Vérifier les mises à jour"
              aria-label="Vérifier les mises à jour"
              @click="emit('check-updates')"
            >
              v{{ version }}
            </button>
            <span v-if="checkState === 'checking'" class="check-state">vérification…</span>
            <span v-else-if="checkState === 'upToDate'" class="check-state">à jour</span>
          </h1>
          <div class="sub"><slot name="subtitle" /></div>
          <!-- Discret et non bloquant : une ligne dans le header, aucune modale
               imposée au lancement. -->
          <button
            v-if="updateVersion !== null"
            type="button"
            class="update-badge"
            :title="`Voir les nouveautés de la version ${updateVersion}`"
            @click="emit('open-update')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v9" />
              <path d="M8 10l4-5 4 5" />
              <path d="M5 19h14" />
            </svg>
            v{{ updateVersion }} disponible
          </button>
        </div>
      </div>

      <!-- Le header reste commun à tous les onglets : seul ce panneau change. -->
      <div
        :id="`sidebar-panel-${activeTab}`"
        class="sidebar__panel"
        role="tabpanel"
        :aria-labelledby="`sidebar-tab-${activeTab}`"
      >
        <slot />
      </div>

      <!-- Hors du tabpanel : ces actions ne dépendent pas de l'onglet actif et
           doivent rester atteignables partout (#66). -->
      <SidebarActions
        :poi-edit-mode="poiEditMode"
        @new-character="emit('new-character')"
        @new-group="emit('new-group')"
        @new-poi="emit('new-poi')"
        @new-story="emit('new-story')"
      >
        <template #transfer><slot name="transfer" /></template>
      </SidebarActions>
    </aside>
  </div>
</template>

<style scoped>
.sidebar-dock {
  flex: 0 0 var(--sidebar-width);
  position: relative;
  /* Au-dessus de la carte : les intercalaires de #52 déborderont par-dessus. */
  z-index: 15;
}

.sidebar {
  width: 100%;
  height: 100%;
  background: var(--panel);
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.sidebar__header {
  padding: 18px 18px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border);
}
.brand-mark {
  flex: none;
  display: flex;
}
.brand-mark img {
  width: 28px;
  height: 28px;
}
.brand-text {
  flex: 1;
  min-width: 0;
}
.brand-text h1 {
  font-size: 1.28rem;
  letter-spacing: 0.02em;
  color: var(--text);
}
/* Bouton mais rendu identique à l'ancien libellé : le clic est un raccourci,
   pas une action à mettre en avant. */
.brand-text h1 .version {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  vertical-align: middle;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.brand-text h1 .version:hover {
  color: var(--accent);
}
.brand-text h1 .check-state {
  font-size: 0.62rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  vertical-align: middle;
}

.update-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid var(--accent-dim);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-family: var(--font-body);
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: var(--accent);
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}
.update-badge:hover {
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  border-color: var(--accent);
}
.update-badge svg {
  flex: none;
  width: 12px;
  height: 12px;
}
.brand-text .sub {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.sidebar-tabs {
  position: absolute;
  left: 100%;
  top: 88px;
  display: flex;
  flex-direction: column;
  /* 1px : les onglets forment un bloc continu plutôt qu'une série d'éléments
     flottants (#89). */
  gap: 1px;
  /* Alignés sur le panneau : c'est ce qui permet à l'onglet actif de s'élargir
     vers la carte sans déplacer les deux autres. */
  align-items: flex-start;
  z-index: 2;
}

/* min-height: 0 obligatoire : ce panneau s'interpose entre l'aside flex et
   .sidebar__list, sans lui la liste perdrait son overflow-y et la sidebar
   déborderait au lieu de scroller. */
.sidebar__panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}


</style>
