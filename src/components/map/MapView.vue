<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import { pixelToLatLng, latLngToPixel } from '../../lib/coords.ts'
import { isPoiVisibleAtZoom } from '../../lib/poiVisibility.ts'
import { buildPinIcon, type PinKind } from './pinIcon.ts'
import ToolbarButton from '../layout/ToolbarButton.vue'
import CharacterPinPopup from './CharacterPinPopup.vue'
import type { Character, Poi } from '../../../shared/schemas.ts'

type SelectedPin = { characterId: string; kind: PinKind }

const props = defineProps<{
  imageUrl: string
  imageWidth: number
  imageHeight: number
  pois: Poi[]
  editMode: boolean
  characters: Character[]
  showHomePins: boolean
  showKnownPins: boolean
  hoveredCharacterId: string | null
  selectedPin: SelectedPin | null
  centerTarget: { x: number; y: number } | null
  placementActive: boolean
}>()

const emit = defineEmits<{
  'poi-click': [string]
  'map-click': [{ x: number; y: number }]
  'poi-moved': [{ id: string; x: number; y: number }]
  'toggle-edit-mode': []
  'pin-click': [SelectedPin]
  'pin-hover': [string]
  'pin-unhover': [string]
  'toggle-home-pins': []
  'toggle-known-pins': []
  'open-character': [string]
  'close-popup': []
  'cancel-placement': []
}>()

const container = useTemplateRef<HTMLElement>('container')

// Instance Leaflet et markers hors réactivité Vue : simples variables, jamais
// dans un ref/reactive (docs/leaflet-et-vue.md §4).
let map: L.Map | null = null
let minZoom = 0
const markersById = new Map<string, L.Marker>()
const pinMarkersByKey = new Map<string, L.Marker>()

const popupAnchor = ref<{ left: number; top: number; character: Character } | null>(null)

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

const PIN_KINDS: readonly PinKind[] = ['home', 'known']

// Deux pins possibles par personnage (générale/connue, CDC §5.1), synchronisés
// par la même stratégie de diff que les POI.
function syncPins(characters: readonly Character[]): void {
  if (map === null) return
  const seen = new Set<string>()

  for (const character of characters) {
    for (const kind of PIN_KINDS) {
      const position = kind === 'home' ? character.homePosition : character.knownPosition
      const visible = kind === 'home' ? props.showHomePins : props.showKnownPins
      if (position === undefined || !visible) continue

      const key = `${character.id}:${kind}`
      seen.add(key)
      const active = props.hoveredCharacterId === character.id
      const icon = L.divIcon({
        className: 'pin-icon-wrapper',
        html: buildPinIcon(character, kind, { active }),
      })
      const [lat, lng] = pixelToLatLng(position.x, position.y)
      const existing = pinMarkersByKey.get(key)

      if (existing === undefined) {
        const marker = L.marker([lat, lng], { icon })
        marker.on('click', () => emit('pin-click', { characterId: character.id, kind }))
        marker.on('mouseover', () => emit('pin-hover', character.id))
        marker.on('mouseout', () => emit('pin-unhover', character.id))
        marker.addTo(map)
        pinMarkersByKey.set(key, marker)
      } else {
        existing.setLatLng([lat, lng])
        existing.setIcon(icon)
      }
    }
  }

  for (const [key, marker] of pinMarkersByKey) {
    if (!seen.has(key)) {
      marker.remove()
      pinMarkersByKey.delete(key)
    }
  }
}

const POPUP_WIDTH = 240
const POPUP_HEIGHT = 170
const POPUP_GAP = 22

// Placée à droite ou à gauche du pin selon la place disponible à l'écran
// (CDC §5.1), recalculée à chaque pan/zoom pour rester collée au pin.
function updatePopupAnchor(): void {
  const target = props.selectedPin
  if (map === null || target === null) {
    popupAnchor.value = null
    return
  }

  const character = props.characters.find((c) => c.id === target.characterId)
  const position = target.kind === 'home' ? character?.homePosition : character?.knownPosition
  if (character === undefined || position === undefined) {
    popupAnchor.value = null
    return
  }

  const [lat, lng] = pixelToLatLng(position.x, position.y)
  const point = map.latLngToContainerPoint([lat, lng])
  const size = map.getSize()

  const side = point.x + POPUP_GAP + POPUP_WIDTH <= size.x ? 'right' : 'left'
  const rawLeft = side === 'right' ? point.x + POPUP_GAP : point.x - POPUP_GAP - POPUP_WIDTH
  const left = Math.max(8, Math.min(rawLeft, size.x - POPUP_WIDTH - 8))
  const top = Math.max(8, Math.min(point.y - POPUP_HEIGHT / 2, size.y - POPUP_HEIGHT - 8))

  popupAnchor.value = { left, top, character }
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
    if (props.editMode || props.placementActive) {
      emit('map-click', latLngToPixel(event.latlng.lat, event.latlng.lng))
      return
    }
    // Clic en dehors d'un pin, mini-fiche ouverte : la ferme (Échap/clic
    // dehors partout, backlog #18).
    if (popupAnchor.value !== null) emit('close-popup')
  })
  map.on('move zoom', updatePopupAnchor)

  syncMarkers(props.pois)
  syncPins(props.characters)
  updatePopupAnchor()

  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  map?.remove()
  map = null
  markersById.clear()
  pinMarkersByKey.clear()
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (props.placementActive) emit('cancel-placement')
  else if (popupAnchor.value !== null) emit('close-popup')
}

function updateCursor(): void {
  if (map === null) return
  map.getContainer().style.cursor = props.editMode || props.placementActive ? 'crosshair' : ''
}

watch(() => props.pois, (pois) => syncMarkers(pois), { deep: true })

watch(() => props.editMode, () => {
  updateCursor()
  syncMarkers(props.pois)
})

watch(() => props.placementActive, updateCursor)

watch(() => props.characters, (characters) => syncPins(characters), { deep: true })
watch([() => props.showHomePins, () => props.showKnownPins], () => syncPins(props.characters))
watch(
  () => props.hoveredCharacterId,
  () => syncPins(props.characters),
)
watch(
  () => props.selectedPin,
  () => updatePopupAnchor(),
  { deep: true },
)

watch(
  () => props.centerTarget,
  (target) => {
    if (map === null || target === null) return
    // setView({animate:false}), pas panTo : un panTo animé déclenché depuis ce
    // watcher se fait annuler par le prochain cycle réactif de Vue et revient
    // à la position de départ (repro : cliquer sur l'œil ne bougeait jamais
    // la carte alors que le watcher recevait bien la bonne cible).
    map.setView(pixelToLatLng(target.x, target.y), map.getZoom(), { animate: false })
  },
)
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" class="map-container" />
    <div class="map__toolbar">
      <ToolbarButton
        :variant="showHomePins ? 'primary' : 'default'"
        label="Basculer positions générales"
        @click="$emit('toggle-home-pins')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="7" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        :variant="showKnownPins ? 'primary' : 'default'"
        label="Basculer dernières positions connues"
        @click="$emit('toggle-known-pins')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </ToolbarButton>
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

    <CharacterPinPopup
      v-if="popupAnchor"
      :character="popupAnchor.character"
      :style="{ left: `${popupAnchor.left}px`, top: `${popupAnchor.top}px` }"
      @open="$emit('open-character', $event)"
      @close="$emit('close-popup')"
    />

    <div v-if="placementActive" class="map__placement-banner">
      <span>Cliquez sur la carte pour placer le pin</span>
      <ToolbarButton
        variant="ghost"
        label="Annuler le placement"
        @click="$emit('cancel-placement')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6l12 12M18 6L6 18" />
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

.map__placement-banner {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  background: color-mix(in srgb, var(--panel) 92%, transparent 8%);
  backdrop-filter: blur(6px);
  border: 1px solid var(--accent-dim);
  border-radius: var(--radius-md);
  padding: 8px 8px 8px 14px;
  font-size: 0.82rem;
  color: var(--text);
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

:deep(.pin-icon-wrapper) {
  background: transparent;
  border: none;
}
:deep(.pin) {
  position: relative;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Étiquette au survol uniquement quand le curseur est précisément sur le
     cercle (CDC §5.1) : seul .pin__ring reçoit les événements pointeur. */
  pointer-events: none;
}
:deep(.pin__ring) {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--panel);
  color: var(--text-muted);
  border: 3px solid var(--rel-inconnu);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.12s ease;
  pointer-events: auto;
  cursor: pointer;
}
:deep(.pin__ring img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
:deep(.pin__tail) {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid var(--rel-inconnu);
  margin-top: -1px;
}
:deep(.pin.is-known .pin__ring) {
  border-style: dashed;
}
:deep(.pin.is-known .pin__tail) {
  border-top-style: dashed;
  border-top-color: transparent;
}
:deep(.pin.rel-ami .pin__ring) {
  border-color: var(--rel-ami);
}
:deep(.pin.rel-ami .pin__tail) {
  border-top-color: var(--rel-ami);
}
:deep(.pin.rel-neutre .pin__ring) {
  border-color: var(--rel-neutre);
}
:deep(.pin.rel-neutre .pin__tail) {
  border-top-color: var(--rel-neutre);
}
:deep(.pin.rel-ennemi .pin__ring) {
  border-color: var(--rel-ennemi);
}
:deep(.pin.rel-ennemi .pin__tail) {
  border-top-color: var(--rel-ennemi);
}
:deep(.pin.is-known .pin__tail) {
  border-top-color: transparent;
}
:deep(.pin__ring:hover),
:deep(.pin.is-active .pin__ring) {
  transform: scale(1.12);
}
:deep(.pin__label) {
  margin-top: 4px;
  font-size: 0.66rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg) 70%, black 30%);
  padding: 1px 5px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.12s ease;
  white-space: nowrap;
}
:deep(.pin__ring:hover ~ .pin__label),
:deep(.pin.is-active .pin__label) {
  opacity: 1;
}
</style>
