<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import L from 'leaflet'

const props = defineProps<{
  imageUrl: string
  imageWidth: number
  imageHeight: number
}>()

const container = useTemplateRef<HTMLElement>('container')

// Instance Leaflet hors réactivité Vue : simple variable, jamais dans un ref
// ou reactive() (docs/leaflet-et-vue.md §4).
let map: L.Map | null = null

onMounted(() => {
  if (container.value === null) return

  const bounds: L.LatLngBoundsExpression = [
    [-props.imageHeight, 0],
    [0, props.imageWidth],
  ]

  map = L.map(container.value, { crs: L.CRS.Simple, maxZoom: 4 })
  L.imageOverlay(props.imageUrl, bounds).addTo(map)

  // Bornée : jamais de zoom arrière au-delà de « voir toute l'image », jamais
  // de pan hors de ses limites.
  map.setMinZoom(map.getBoundsZoom(bounds, true))
  map.setMaxBounds(bounds)
  map.fitBounds(bounds)
})

onUnmounted(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="map-view" />
</template>

<style scoped>
.map-view {
  position: absolute;
  inset: 0;
  /* z-index explicite : établit un contexte d'empilement propre, sinon les
     panes internes de Leaflet (200-650) passeraient devant la sidebar. */
  z-index: 0;
  background: var(--bg);
}
</style>
