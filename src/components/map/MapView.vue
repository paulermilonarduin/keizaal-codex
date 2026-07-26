<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import { pixelToLatLng, latLngToPixel } from '../../lib/coords.ts'
import { isPoiLabelVisibleAtZoom } from '../../lib/poiVisibility.ts'
import { poiIconUrl } from '../../lib/poiIcons.ts'
import { ABSOLUTE_MIN_ZOOM, MAX_ZOOM, fitZoom, zoomAfterResize } from '../../lib/mapViewport.ts'
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
  hoveredPoiId: string | null
  selectedPin: SelectedPin | null
  centerTarget: { x: number; y: number } | null
  placementActive: boolean
}>()

const emit = defineEmits<{
  'poi-click': [string]
  'map-click': [{ x: number; y: number }]
  'poi-moved': [{ id: string; x: number; y: number }]
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
let resizeObserver: ResizeObserver | null = null
const markersById = new Map<string, L.Marker>()
const pinMarkersByKey = new Map<string, L.Marker>()

const popupAnchor = ref<{ left: number; top: number; character: Character } | null>(null)

function escapeHtml(value: string): string {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML
}

// `labelled` ne masque plus que le nom : le repère, lui, est toujours rendu
// (#68). L'icône est posée en mask-image pour être teintée par le CSS, ce qui
// garde une seule source de couleur pour les POI.
function buildPoiIcon(poi: Poi, labelled: boolean, editable: boolean, hovered: boolean): L.DivIcon {
  const classes = ['poi-marker']
  if (poi.type === 'capitale') classes.push('is-major')
  if (editable) classes.push('is-editable')
  if (hovered) classes.push('is-hovered')
  const label = labelled
    ? `<span class="poi-label">${escapeHtml(poi.name)}</span>`
    : ''
  return L.divIcon({
    className: 'poi-icon-wrapper',
    html: `<div class="${classes.join(' ')}"><span class="poi-glyph" style="--poi-icon: url('${poiIconUrl(poi.type)}')"></span>${label}</div>`,
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
    const hovered = props.hoveredPoiId === poi.id
    // Le survol depuis la liste force l'étiquette : sans elle, on ne sait pas
    // lequel des marqueurs identiques vient de s'éclairer.
    const labelled = hovered || isPoiLabelVisibleAtZoom(poi.type, zoom, minZoom)
    const [lat, lng] = pixelToLatLng(poi.x, poi.y)
    const existing = markersById.get(poi.id)

    if (existing === undefined) {
      const marker = L.marker([lat, lng], {
        icon: buildPoiIcon(poi, labelled, props.editMode, hovered),
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
      existing.setIcon(buildPoiIcon(poi, labelled, props.editMode, hovered))
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

function containerSize(): { width: number; height: number } {
  const size = map?.getSize()
  return { width: size?.x ?? 0, height: size?.y ?? 0 }
}

// Le conteneur a changé de taille : on réaligne Leaflet, le plancher de zoom,
// la visibilité des POI et l'ancrage de la mini-fiche. L'ORDRE compte (#55).
function applyContainerSize(): void {
  if (map === null) return

  // 1. Avant toute mesure : getSize() sert un cache (_sizeChanged), mesurer
  //    d'abord donnerait l'ancienne taille.
  map.invalidateSize()

  const size = containerSize()
  // 2. Conteneur masqué ou démonté : le ResizeObserver émet des 0×0.
  if (size.width === 0 || size.height === 0) return

  const nextMin = fitZoom(size, { width: props.imageWidth, height: props.imageHeight })
  // 3. Seuil : sans lui, glisser lentement le bord de la fenêtre fait
  //    clignoter les étiquettes POI quand on est pile au seuil de visibilité.
  if (Math.abs(nextMin - minZoom) > 0.01) {
    const target = zoomAfterResize(map.getZoom(), minZoom, nextMin)
    // 4. Ordre impératif : on ouvre la plage AVANT de viser la cible, sinon
    //    setView clampe au plancher encore en vigueur (l'image débordait du
    //    conteneur après rétrécissement). Puis on referme sur le nouveau
    //    plancher — jamais l'inverse, car un setMinZoom au-dessus du zoom
    //    courant déclencherait un setZoom animé, saccadé pendant un drag.
    map.setMinZoom(ABSOLUTE_MIN_ZOOM)
    map.setView(map.getCenter(), target, { animate: false })
    map.setMinZoom(nextMin)
    minZoom = nextMin
  }

  // 5. La visibilité des POI est relative au plancher : sans ça elle resterait
  //    calculée avec l'ancien jusqu'au prochain zoom manuel (syncMarkers n'est
  //    câblé que sur zoomend).
  syncMarkers(props.pois)
  // 6. invalidateSize n'émet pas toujours `move` (early-return quand l'offset
  //    de centre arrondit à 0), donc l'ancrage ne se recalculerait pas seul.
  updatePopupAnchor()
}

onMounted(() => {
  if (container.value === null) return

  const bounds: L.LatLngBoundsExpression = [
    [-props.imageHeight, 0],
    [0, props.imageWidth],
  ]

  // Contrôles par défaut retirés puis recréés : le zoom en haut à droite (à
  // gauche il passait sous la sidebar, #37), l'attribution en bas à gauche
  // (#49 ; le défaut Leaflet est en bas à droite, où elle gênait la légende).
  // zoomSnap 0 : fit exact de l'image, pas arrondi au niveau entier inférieur.
  // trackResize false : Leaflet appellerait invalidateSize() de lui-même sur
  // window.resize, mais sans recalculer notre plancher de zoom. Un seul
  // chemin, le nôtre, via ResizeObserver — qui couvre en plus le zoom
  // navigateur et tout changement de layout, pas seulement la fenêtre (#55).
  map = L.map(container.value, {
    crs: L.CRS.Simple,
    minZoom: ABSOLUTE_MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0,
    zoomControl: false,
    attributionControl: false,
    trackResize: false,
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.control.attribution({ position: 'bottomleft' }).addTo(map)
  L.imageOverlay(props.imageUrl, bounds).addTo(map)

  // Bornée : jamais de zoom arrière au-delà de « voir toute l'image », jamais
  // de pan hors de ses limites (#39). Le plancher est recalculé à chaque
  // redimensionnement du conteneur (cf. applyContainerSize).
  minZoom = fitZoom(containerSize(), { width: props.imageWidth, height: props.imageHeight })
  map.setMinZoom(minZoom)
  map.setMaxBounds(bounds)
  // setView explicite et pas fitBounds : fitBounds recalcule son propre zoom
  // via getBoundsZoom, qui diffère légèrement de notre fitZoom. Le zoom
  // initial ne serait alors pas EXACTEMENT le plancher, et zoomAfterResize ne
  // reconnaîtrait pas « l'utilisateur est au dézoom maximal » — l'image
  // débordait du conteneur après rétrécissement de la fenêtre (#55).
  map.setView([-props.imageHeight / 2, props.imageWidth / 2], minZoom, { animate: false })

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

  // Un seul appel par frame : requestAnimationFrame et pas setTimeout, pour
  // rester synchrone avec le layout. Le premier callback survient dès
  // l'observe(), ce qui confirme gratuitement la taille au premier montage.
  let pending = 0
  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(applyContainerSize)
  })
  resizeObserver.observe(container.value)

  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
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
  () => props.hoveredPoiId,
  () => syncMarkers(props.pois),
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
    // Le zoom courant est conservé : depuis #68 tous les marqueurs sont
    // visibles, il n'y a plus de cible à « déterrer » en zoomant.
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
      <!-- Le bouton de mode édition des POI a rejoint le pied de sidebar (#66) :
           il y côtoie les autres actions de création. Cette barre ne garde que
           ce qui pilote l'affichage de la carte elle-même. -->
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
  flex: 1 1 0;
  min-width: 0;
  /* `relative` (et pas `absolute`) : la carte est un item flex, mais elle doit
     rester le bloc conteneur de .map-container, de la barre d'outils, du
     bandeau de placement et de la mini-fiche. */
  position: relative;
  /* z-index explicite : établit un contexte d'empilement qui aplatit tout le
     sous-arbre Leaflet (panes 200-700). Indispensable même sans recouvrement
     géométrique — c'est lui qui empêche les tuiles de passer devant les
     modales (20), le bandeau d'import (30) et celui d'erreur (40), tous
     inférieurs aux z-index internes de Leaflet. */
  z-index: 0;
}
.map-container {
  position: absolute;
  inset: 0;
  background: var(--bg);
  /* z-index explicite pour créer un contexte d'empilement local et aplatir tout
     le sous-arbre Leaflet (#67). Sans lui, .map-container n'en crée aucun : les
     panes internes (marqueurs 600, popups 700, contrôles 800, coins 1000)
     concourent directement avec les frères de ce conteneur, et passaient donc
     devant la barre d'outils dès qu'un POI s'affichait à côté d'elle. */
  z-index: 0;
}

/* Ancrée en bas à droite (#67) : le coin haut-droit est occupé par le contrôle
   de zoom Leaflet, et le bas-gauche par l'attribution (#49). */
.map__toolbar {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 6px;
  /* Fond opaque, sans flou : la carte ne doit plus se deviner derrière. */
  background: var(--panel);
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
  color: var(--poi);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.82rem;
  white-space: nowrap;
  pointer-events: none;
  /* Même raison que le halo du glyphe : l'étiquette rouge était illisible sur
     les zones sombres de la carte. */
  text-shadow:
    0 0 2px rgba(255, 255, 255, 0.95),
    0 0 4px rgba(255, 255, 255, 0.7);
}
:deep(.poi-marker.is-editable) {
  pointer-events: auto;
  cursor: grab;
}
/* Survolé depuis la liste (#54) : passe en doré et grossit, pour rester
   repérable même noyé au milieu des autres POI rouges. */
:deep(.poi-marker.is-hovered) {
  color: var(--accent);
  font-size: 0.95rem;
  z-index: 1000;
}
:deep(.poi-marker.is-hovered .poi-glyph) {
  background: var(--accent);
  width: 22px;
  height: 22px;
}

/* L'icône du type remplace le point (#68). mask-image plutôt qu'un <img> :
   les PNG sont des silhouettes avec canal alpha, la teinte reste donc pilotée
   par --poi comme le reste des POI. L'URL du fichier arrive en variable
   inline depuis buildPoiIcon. */
:deep(.poi-glyph) {
  flex: none;
  width: 16px;
  height: 16px;
  background: var(--poi);
  /* Halo clair, comme sur une carte imprimée : la carte de Skyrim n'est pas
     uniformément crème. Mesuré sur l'image réelle, le contraste de #71351F va
     de 4,66 sur le parchemin clair à 1,25 sur les reliefs et l'eau — sans halo
     l'icône y disparaît. drop-shadow suit la silhouette du masque, contrairement
     à un box-shadow qui cernerait le carré. */
  filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.95))
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.65));
  mask-image: var(--poi-icon);
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
  -webkit-mask-image: var(--poi-icon);
  -webkit-mask-size: contain;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
}
/* Les capitales ne se distinguent que par la taille : même rouge que le reste
   des POI (#49). */
:deep(.poi-marker.is-major) {
  font-size: 0.92rem;
}
:deep(.poi-marker.is-major .poi-glyph) {
  width: 20px;
  height: 20px;
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
