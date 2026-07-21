<script setup lang="ts">
import { onMounted } from 'vue'
import { api } from './api/singleton.ts'
import { useCharactersStore } from './stores/characters.store.ts'
import { useGroupsStore } from './stores/groups.store.ts'
import { usePoisStore } from './stores/pois.store.ts'
import { loadInitialData } from './stores/bootstrap.ts'
import SidebarPanel from './components/layout/SidebarPanel.vue'

const characters = useCharactersStore()
const groups = useGroupsStore()
const pois = usePoisStore()

onMounted(() => {
  void loadInitialData(api, { characters, groups, pois })
})
</script>

<template>
  <main class="app">
    <SidebarPanel>
      <template #subtitle>{{ characters.characters.length }} personnage(s) suivi(s)</template>
    </SidebarPanel>
    <div class="map-placeholder" />
  </main>
</template>

<style scoped>
.app {
  position: relative;
  height: 100vh;
}
.map-placeholder {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      1100px 700px at 18% 20%,
      color-mix(in srgb, var(--accent) 10%, var(--bg) 90%),
      transparent 60%
    ),
    radial-gradient(
      900px 620px at 82% 78%,
      color-mix(in srgb, var(--rel-inconnu) 22%, var(--bg) 78%),
      transparent 65%
    ),
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--bg) 92%, black 8%),
      var(--bg) 55%,
      color-mix(in srgb, var(--bg) 88%, white 12%)
    );
}
</style>
