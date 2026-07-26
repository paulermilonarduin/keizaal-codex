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

const props = defineProps<{ version: string; activeTab: SidebarTabId; poiEditMode: boolean }>()

const emit = defineEmits<{
  'select-tab': [SidebarTabId]
  'new-character': []
  'new-group': []
  'new-poi': []
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
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="12" cy="12" r="9.3" />
            <path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21" />
            <path d="M12 8.6l1.6 3.4 3.4 1.6-3.4 1.6L12 18.8l-1.6-3.6-3.4-1.6 3.4-1.6z" />
          </svg>
        </span>
        <div class="brand-text">
          <h1>Codex Keizaal <span class="version">v{{ version }}</span></h1>
          <div class="sub"><slot name="subtitle" /></div>
        </div>
      </div>

      <!-- Le header reste commun aux trois onglets : seul ce panneau change. -->
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
  color: var(--accent);
}
.brand-mark svg {
  width: 26px;
  height: 26px;
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
.brand-text h1 .version {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  vertical-align: middle;
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
  gap: 4px;
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
