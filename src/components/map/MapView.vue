<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import { pixelToLatLng, latLngToPixel } from '../../lib/coords.ts'
import { isPoiVisibleAtZoom } from '../../lib/poiVisibility.ts'
import ToolbarButton from '../layout/ToolbarButton.vue'
import type { Poi } from '../../../shared/schemas.ts'

const props = defineProps<{
  imageUrl: string
  imageWidth: number
  imageHeight: number
  pois: Poi[]
  editMode: boolean
}>()

const emit = defineEmits<{
  'poi-click': [string]
  'map-click': [{ x: number; y: number }]
  'poi-moved': [{ id: string; x: number; y: number }]
  'toggle-edit-mode': []
}>()

const container = useTemplateRef<HTMLElement>('container')

// Instance Leaflet et markers hors réactivité Vue : simples variables, jamais
// dans un ref/reactive (docs/leaflet-et-vue.md §4).
let map: L.Map | null = null
let minZoom = 0
const markersById = new Map<string, L.Marker>()

function escapeHtml(value: string): string {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML
}

function buildPoiIcon(poi: Poi, visible: boolean, editable: boolean): L.DivIcon {
  const classes = ['poi-marker']
  if (poi.type === 'capitale') classes.push('is-major')
  if (!visible) classes.push('is-hidden')
  if (editable) classes.push('is-editable')
  return L.divIcon({
    className: 'poi-icon-wrapper',
    html: `<div class="${classes.join(' ')}"><span class="poi-dot"></span><span class="poi-label">${escapeHtml(poi.name)}</span></div>`,
  })
}

// Sync par diff d'id (docs/leaflet-et-vue.md §4, pattern 2) : crée les
// manquants, met à jour les existants (position, icône), retire les disparus.
function syncMarkers(pois: readonly Poi[]): void {
  if (map === null) return
  const zoom = map.getZoom()
  const seen = new Set<string>()

  for (const poi of pois) {
    seen.add(poi.id)
    const visible = isPoiVisibleAtZoom(poi.type, zoom, minZoom)
    const [lat, lng] = pixelToLatLng(poi.x, poi.y)
    const existing = markersById.get(poi.id)

    if (existing === undefined) {
      const marker = L.marker([lat, lng], {
        icon: buildPoiIcon(poi, visible, props.editMode),
        draggable: props.editMode,
      })
      marker.on('click', () => {
        if (props.editMode) emit('poi-click', poi.id)
      })
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        emit('poi-moved', { id: poi.id, ...latLngToPixel(position.lat, position.lng) })
      })
      marker.addTo(map)
      markersById.set(poi.id, marker)
    } else {
      existing.setLatLng([lat, lng])
      existing.setIcon(buildPoiIcon(poi, visible, props.editMode))
      if (props.editMode) existing.dragging?.enable()
      else existing.dragging?.disable()
    }
  }

  for (const [id, marker] of markersById) {
    if (!seen.has(id)) {
      marker.remove()
      markersById.delete(id)
    }
  }
}

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
  minZoom = map.getBoundsZoom(bounds, true)
  map.setMinZoom(minZoom)
  map.setMaxBounds(bounds)
  map.fitBounds(bounds)

  map.on('zoomend', () => syncMarkers(props.pois))
  map.on('click', (event: L.LeafletMouseEvent) => {
    if (!props.editMode) return
    emit('map-click', latLngToPixel(event.latlng.lat, event.latlng.lng))
  })

  syncMarkers(props.pois)
})

onUnmounted(() => {
  map?.remove()
  map = null
  markersById.clear()
})

watch(() => props.pois, (pois) => syncMarkers(pois), { deep: true })

watch(
  () => props.editMode,
  (editMode) => {
    if (map !== null) map.getContainer().style.cursor = editMode ? 'crosshair' : ''
    syncMarkers(props.pois)
  },
)
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" class="map-container" />
    <div class="map__toolbar">
      <ToolbarButton
        :variant="editMode ? 'primary' : 'default'"
        :label="editMode ? 'Quitter le mode édition des POI' : 'Éditer les POI'"
        @click="$emit('toggle-edit-mode')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </ToolbarButton>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: absolute;
  inset: 0;
  /* z-index explicite : établit un contexte d'empilement propre, sinon les
     panes internes de Leaflet (200-650) passeraient devant la sidebar. */
  z-index: 0;
}
.map-container {
  position: absolute;
  inset: 0;
  background: var(--bg);
}

.map__toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 6px;
  background: color-mix(in srgb, var(--panel) 82%, transparent 18%);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px;
}

:deep(.poi-icon-wrapper) {
  background: transparent;
  border: none;
}
:deep(.poi-marker) {
  position: relative;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.82rem;
  white-space: nowrap;
  pointer-events: none;
}
:deep(.poi-marker.is-hidden) {
  display: none;
}
:deep(.poi-marker.is-editable) {
  pointer-events: auto;
  cursor: grab;
}
:deep(.poi-dot) {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);
  flex: none;
}
:deep(.poi-marker.is-major) {
  font-size: 0.92rem;
  color: color-mix(in srgb, var(--text) 80%, var(--accent) 20%);
}
:deep(.poi-marker.is-major .poi-dot) {
  width: 5px;
  height: 5px;
  background: var(--accent-dim);
}
</style>
