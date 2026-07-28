<script setup lang="ts">
import { computed } from 'vue'
import SearchBar from './SearchBar.vue'
import StoryCard from './StoryCard.vue'
import { filterStories } from '../../lib/filterStories.ts'
import { useUiStore } from '../../stores/ui.store.ts'
import type { Story } from '../../../shared/schemas.ts'

// Même contrat que CharactersPanel et PoisPanel : lit l'état d'interface,
// remonte les mutations de domaine (ARCHITECTURE.md §5.3).
const props = defineProps<{ stories: Story[] }>()

defineEmits<{ edit: [string]; remove: [string] }>()

const ui = useUiStore()

const filtered = computed(() => filterStories(props.stories, ui.storySearch))
</script>

<template>
  <div class="sidebar__tools">
    <SearchBar
      v-model="ui.storySearch"
      placeholder="Rechercher une histoire…"
      aria-label="Rechercher une histoire"
    />
  </div>

  <div class="sidebar__list">
    <div class="list-label">Histoires</div>
    <p v-if="stories.length === 0" class="empty-state">
      Aucune histoire. Utilisez le bouton « Nouvelle histoire » pour en créer une.
    </p>
    <p v-else-if="filtered.length === 0" class="empty-state">
      Aucune histoire ne correspond à cette recherche.
    </p>
    <StoryCard
      v-for="story in filtered"
      :key="story.id"
      :story="story"
      @edit="$emit('edit', $event)"
      @remove="$emit('remove', $event)"
    />
  </div>
</template>

<style scoped>
.list-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  padding: 4px 4px 2px;
}
.empty-state {
  padding: 16px 4px;
  font-size: 0.82rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
