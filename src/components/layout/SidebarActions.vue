<script setup lang="ts">
import ToolbarButton from './ToolbarButton.vue'

// Actions globales du pied de sidebar (#66) : identiques sur tous les onglets,
// puisqu'aucune ne dépend de la liste affichée. Composant dédié plutôt qu'un
// bloc dans SidebarPanel, qui a déjà la charge des onglets et de l'en-tête.
defineProps<{ poiEditMode: boolean }>()

defineEmits<{ 'new-character': []; 'new-group': []; 'new-poi': []; 'new-story': [] }>()
</script>

<template>
  <div class="sidebar__footer">
    <ToolbarButton variant="primary" label="Nouveau personnage" @click="$emit('new-character')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </ToolbarButton>

    <ToolbarButton label="Nouveau groupe" @click="$emit('new-group')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M16 14.3c2.6.4 4.5 2.2 4.5 5" />
      </svg>
    </ToolbarButton>

    <!-- Bascule, pas une création directe : le flux reste « poser sur la carte
         puis remplir la modale » (le clic carte fournit les coordonnées). -->
    <ToolbarButton
      :variant="poiEditMode ? 'primary' : 'default'"
      :label="poiEditMode ? 'Quitter le mode édition des POI' : 'Nouveau point d\'intérêt'"
      @click="$emit('new-poi')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
    </ToolbarButton>

    <ToolbarButton label="Nouvelle histoire" @click="$emit('new-story')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4.5h6a2.5 2.5 0 0 1 2.5 2.5v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4.5h-6a2.5 2.5 0 0 0-2.5 2.5v13a2 2 0 0 1 2-2H20z" />
      </svg>
    </ToolbarButton>

    <span class="spacer" />

    <slot name="transfer" />
  </div>
</template>

<style scoped>
/* Export/import repoussés à droite : ils ne créent rien, la séparation visuelle
   évite de les confondre avec les boutons de création. */
.spacer {
  flex: 1;
}
</style>
