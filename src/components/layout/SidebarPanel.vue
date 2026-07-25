<script setup lang="ts">
defineProps<{ version: string }>()
</script>

<template>
  <!-- Le dock ne clippe pas : c'est lui qui laissera les intercalaires
       verticaux déborder sur la carte (#52), alors que .sidebar garde son
       overflow: hidden pour le scroll de la liste. -->
  <div class="sidebar-dock">
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

      <div class="sidebar__tools"><slot name="tools" /></div>
      <div class="sidebar__list"><slot name="list" /></div>
      <div class="sidebar__footer"><slot name="footer" /></div>
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
.sidebar__tools {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--border);
}
.sidebar__list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar__footer {
  padding: 12px 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

</style>
