<script setup lang="ts">
import { useUiStore } from '../../stores/ui.store.ts'
import ToolbarButton from './ToolbarButton.vue'

const ui = useUiStore()
</script>

<template>
  <ToolbarButton
    v-if="ui.sidebarCollapsed"
    class="reopen-toggle"
    label="Afficher la liste"
    @click="ui.toggleSidebar()"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </ToolbarButton>

  <aside class="sidebar" :class="{ 'is-collapsed': ui.sidebarCollapsed }">
    <div class="sidebar__header">
      <span class="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="12" cy="12" r="9.3" />
          <path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21" />
          <path d="M12 8.6l1.6 3.4 3.4 1.6-3.4 1.6L12 18.8l-1.6-3.6-3.4-1.6 3.4-1.6z" />
        </svg>
      </span>
      <div class="brand-text">
        <h1>Codex Keizaal</h1>
        <div class="sub"><slot name="subtitle" /></div>
      </div>
      <ToolbarButton
        variant="ghost"
        class="collapse-toggle"
        label="Replier la liste"
        @click="ui.toggleSidebar()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </ToolbarButton>
    </div>

    <div class="sidebar__tools"><slot name="tools" /></div>
    <div class="sidebar__list"><slot name="list" /></div>
    <div class="sidebar__footer"><slot name="footer" /></div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 340px;
  z-index: 15;
  background: var(--panel);
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  transform: translateX(0);
  transition: transform 0.22s ease;
}
.sidebar.is-collapsed {
  transform: translateX(-100%);
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
.brand-text .sub {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.sidebar__tools,
.sidebar__list,
.sidebar__footer {
  min-height: 0;
}
.sidebar__tools:empty,
.sidebar__list:empty,
.sidebar__footer:empty {
  display: none;
}
.sidebar__list {
  flex: 1 1 auto;
  overflow-y: auto;
}

.reopen-toggle {
  position: fixed;
  left: 10px;
  top: 16px;
  z-index: 5;
}
</style>
