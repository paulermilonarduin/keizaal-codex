<script setup lang="ts">
import { computed } from 'vue'
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import { renderReleaseNotes } from '../../lib/releaseNotes.ts'
import type { ReleaseInfo } from '../../lib/updateCheck.ts'

// Jamais montée avec une liste vide : App.vue n'ouvre la modale que s'il y a
// au moins une release plus récente.
const props = defineProps<{ releases: ReleaseInfo[] }>()
defineEmits<{ close: [] }>()

// La liste arrive triée décroissante : la première est la version à installer.
const latest = computed(() => props.releases[0])

// Pas d'auto-update (exe portable non signé, #48) : on amène l'utilisateur sur
// la page de release, que l'exe ouvre dans le navigateur système.
function openDownloadPage(): void {
  const url = latest.value?.url
  if (url === undefined) return
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <ModalShell @close="$emit('close')">
    <template #title>Nouveautés</template>

    <!-- Une section par version ratée : le cumul depuis la version installée
         évite d'avoir à aller lire les patch notes intermédiaires sur GitHub. -->
    <section v-for="release in releases" :key="release.version" class="release">
      <h3>v{{ release.version }}</h3>
      <!-- Le HTML injecté ne vient pas de la release : markdown-it tourne avec
           html: false, tout HTML brut du body est échappé et la sortie est
           produite par son renderer. Rien à sanitizer, d'où la dérogation. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="release.body !== ''" class="notes" v-html="renderReleaseNotes(release.body)" />
      <p v-else class="notes-empty">Aucune note pour cette version.</p>
    </section>

    <template #footer>
      <span class="hint">Téléchargement dans le navigateur</span>
      <ToolbarButton
        v-if="latest"
        variant="primary"
        :label="`Télécharger la version ${latest.version}`"
        @click="openDownloadPage"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 4v10" />
          <path d="M7 11l5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      </ToolbarButton>
    </template>
  </ModalShell>
</template>

<style scoped>
.release + .release {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.release h3 {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  margin-bottom: 8px;
}
.notes-empty,
.hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* :deep() obligatoire : le contenu injecté par v-html n'est pas compilé par
   Vue, les sélecteurs scoped ne l'atteignent pas. */
.notes {
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--text);
}
.notes :deep(h1),
.notes :deep(h2),
.notes :deep(h3) {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin: 12px 0 4px;
}
.notes :deep(h1:first-child),
.notes :deep(h2:first-child),
.notes :deep(h3:first-child) {
  margin-top: 0;
}
.notes :deep(p) {
  margin: 0 0 8px;
}
.notes :deep(ul),
.notes :deep(ol) {
  margin: 0 0 8px;
  padding-left: 18px;
}
.notes :deep(li) {
  margin-bottom: 3px;
}
.notes :deep(a) {
  color: var(--accent);
}
.notes :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 1px 4px;
}
.notes :deep(pre) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  overflow-x: auto;
}
.notes :deep(img) {
  max-width: 100%;
}
</style>
