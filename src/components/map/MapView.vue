<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import L from 'leaflet'
import { pixelToLatLng, latLngToPixel } from '../../lib/coords.ts'
import { isPoiLabelVisibleAtZoom } from '../../lib/poiVisibility.ts'
import { ABSOLUTE_MIN_ZOOM, MAX_ZOOM, fitZoom, zoomAfterResize } from '../../lib/mapViewport.ts'
import { createCenteringController } from '../../lib/mapCentering.ts'
import { buildPinIcon, pinIconGeometry } from './pinIcon.ts'
import { escapeAction, mapContainerClasses } from './placementMode.ts'
import { buildPoiMarkerHtml, poiIconGeometry } from './poiMarker.ts'
import { markerZOffset } from './markerStacking.ts'
import ToolbarButton from '../layout/ToolbarButton.vue'
import CharacterPinPopup from './CharacterPinPopup.vue'
import type { Character, Poi } from '../../../shared/schemas.ts'

const props = defineProps<{
  imageUrl: string
  imageWidth: number
  imageHeight: number
  pois: Poi[]
  editMode: boolean
  characters: Character[]
  showPins: boolean
  hoveredCharacterId: string | null
  hoveredPoiId: string | null
  selectedCharacterId: string | null
  placementActive: boolean
  characterEditMode: boolean
}>()

const emit = defineEmits<{
  'poi-click': [string]
  'map-click': [{ x: number; y: number }]
  'poi-moved': [{ id: string; x: number; y: number }]
  'pin-click': [string]
  'pin-hover': [string]
  'pin-unhover': [string]
  'character-moved': [{ id: string; x: number; y: number }]
  'toggle-pins': []
  'toggle-character-edit': []
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
const pinMarkersById = new Map<string, L.Marker>()

// Le contrôleur porte le séquencement du centrage animé (#87) ; il vit hors
// réactivité comme le reste de ce qui touche à Leaflet (docs/leaflet-et-vue.md §4).
const centering = createCenteringController({
  distanceTo: (target) => {
    if (map === null) return 0
    const point = map.latLngToContainerPoint(pixelToLatLng(target.x, target.y))
    return point.distanceTo(map.getSize().divideBy(2))
  },
  panTo: (target, { duration, easeLinearity }) => {
    if (map === null) return
    // `animate: true` explicite et pas seulement par défaut : sans lui Leaflet
    // refuse d'animer dès que la cible est à plus d'un écran et saute
    // (leaflet-src.js, _tryAnimatedPan). Le zoom n'est jamais touché : panTo
    // conserve le zoom courant par construction.
    map.panTo(pixelToLatLng(target.x, target.y), { animate: true, duration, easeLinearity })
  },
  snapTo: (target) => {
    if (map === null) return
    map.setView(pixelToLatLng(target.x, target.y), map.getZoom(), { animate: false })
  },
})

// Appel impératif exposé au parent plutôt qu'une prop observée : le centrage
// est un ordre ponctuel, pas un état. Une prop recréée à chaque appel plus un
// watcher remettait la carte dans le cycle réactif de Vue, qui annulait
// l'animation en vol (#15).
function centerOn(x: number, y: number): void {
  centering.centerOn({ x, y })
}

defineExpose({ centerOn })

const popupAnchor = ref<{ left: number; top: number; character: Character } | null>(null)

// iconSize/iconAnchor explicites : sans eux Leaflet n'écrit aucune marge de
// recentrage et pose le coin haut-gauche du div sur le point, d'où des repères
// qui dérivaient au zoom (#81). La géométrie vit dans poiMarker.ts, pure et
// testable sans DOM.
function buildPoiIcon(poi: Poi, labelled: boolean, editable: boolean, hovered: boolean): L.DivIcon {
  // La géométrie ne dépend pas du survol (#82) : l'agrandissement est un scale
  // CSS, la boîte et donc l'ancre restent les mêmes.
  const { size, anchor } = poiIconGeometry(poi.type)
  return L.divIcon({
    className: 'poi-icon-wrapper',
    html: buildPoiMarkerHtml(poi, { labelled, editable, hovered }),
    iconSize: size,
    iconAnchor: anchor,
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
      marker.setZIndexOffset(markerZOffset({ hovered, selected: false }))
      marker.addTo(map)
      markersById.set(poi.id, marker)
    } else {
      existing.setLatLng([lat, lng])
      existing.setIcon(buildPoiIcon(poi, labelled, props.editMode, hovered))
      // Fait remonter le marqueur survolé devant ses voisins : le z-index que
      // Leaflet calcule depuis la latitude laissait sinon le POI le plus au sud
      // devant, survol ou pas (#82).
      existing.setZIndexOffset(markerZOffset({ hovered, selected: false }))
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

// Un pin par personnage depuis #80 (CDC §5.1), synchronisé par la même
// stratégie de diff que les POI : la clé est donc l'id du personnage.
function syncPins(characters: readonly Character[]): void {
  if (map === null) return
  const seen = new Set<string>()

  for (const character of characters) {
    const position = character.position
    if (position === undefined || !props.showPins) continue

    seen.add(character.id)
    const hovered = props.hoveredCharacterId === character.id
    const selected = props.selectedCharacterId === character.id
    // `active` porte la mise en avant visuelle : le pin grossit aussi bien au
    // survol que lorsqu'il est le pin sélectionné, dont la mini-fiche est ouverte.
    const active = hovered || selected
    const { size, anchor } = pinIconGeometry()
    const icon = L.divIcon({
      className: 'pin-icon-wrapper',
      html: buildPinIcon(character, { active, editable: props.characterEditMode }),
      iconSize: size,
      iconAnchor: anchor,
    })
    const [lat, lng] = pixelToLatLng(position.x, position.y)
    const existing = pinMarkersById.get(character.id)
    const zOffset = markerZOffset({ hovered, selected })

    if (existing === undefined) {
      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: zOffset,
        draggable: props.characterEditMode,
      })
      // En mode édition le clic ne fait rien (#88) : le mode ne sert qu'au
      // glisser-déposer, et la mini-fiche resterait ancrée à l'ancienne position.
      marker.on('click', () => {
        if (!props.characterEditMode) emit('pin-click', character.id)
      })
      marker.on('mouseover', () => emit('pin-hover', character.id))
      marker.on('mouseout', () => emit('pin-unhover', character.id))
      // L'ancre du pin est la pointe de sa queue (#81) : la latlng du marqueur
      // après un drag EST donc la nouvelle position du personnage.
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        emit('character-moved', { id: character.id, ...latLngToPixel(position.lat, position.lng) })
      })
      marker.addTo(map)
      pinMarkersById.set(character.id, marker)
    } else {
      existing.setLatLng([lat, lng])
      existing.setIcon(icon)
      // Sans ça, deux pins qui se recouvrent gardent l'ordre imposé par leur
      // latitude et survoler celui de derrière ne le rend pas lisible (#82).
      existing.setZIndexOffset(zOffset)
      if (props.characterEditMode) existing.dragging?.enable()
      else existing.dragging?.disable()
    }
  }

  for (const [id, marker] of pinMarkersById) {
    if (!seen.has(id)) {
      marker.remove()
      pinMarkersById.delete(id)
    }
  }
}

const POPUP_WIDTH = 240
const POPUP_HEIGHT = 170
const POPUP_GAP = 22

// Placée à droite ou à gauche du pin selon la place disponible à l'écran
// (CDC §5.1), recalculée à chaque pan/zoom pour rester collée au pin.
function updatePopupAnchor(): void {
  const target = props.selectedCharacterId
  if (map === null || target === null) {
    popupAnchor.value = null
    return
  }

  const character = props.characters.find((c) => c.id === target)
  const position = character?.position
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

  // 0. AVANT tout le reste : un centrage animé en vol va être tué par les
  //    setView ci-dessous, on le termine donc tout de suite sur sa cible (#87).
  //    En tête de fonction impérativement : invalidateSize et setView émettent
  //    des `moveend` synchrones en cours de route, qui passeraient pour une
  //    arrivée et désarmeraient la cible avant un contrôle en fin de fonction.
  //    Bonus : le recalage du plancher de zoom part alors du centre visé.
  centering.handleResize()

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
  // Fin d'un déplacement (arrivée du pan animé, ou pan manuel de
  // l'utilisateur) : plus rien à recaler en cas de redimensionnement (#87).
  map.on('moveend', () => centering.handleMoveEnd())

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
  const action = escapeAction({
    placementActive: props.placementActive,
    popupOpen: popupAnchor.value !== null,
  })
  if (action === 'cancel-placement') emit('cancel-placement')
  else if (action === 'close-popup') emit('close-popup')
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
watch(() => props.showPins, () => syncPins(props.characters))
// Reconstruit les icônes (curseur `grab`) et active ou coupe le drag des pins
// déjà en place (#88).
watch(() => props.characterEditMode, () => syncPins(props.characters))
watch(
  () => props.hoveredCharacterId,
  () => syncPins(props.characters),
)
watch(
  () => props.hoveredPoiId,
  () => syncMarkers(props.pois),
)
watch(
  () => props.selectedCharacterId,
  () => {
    updatePopupAnchor()
    // La sélection change aussi l'empilement et la taille du pin (#82), pas
    // seulement la mini-fiche.
    syncPins(props.characters)
  },
)
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" :class="mapContainerClasses(placementActive)" />
    <div class="map__toolbar">
      <ToolbarButton
        :variant="showPins ? 'primary' : 'default'"
        label="Afficher ou masquer les personnages"
        @click="$emit('toggle-pins')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        :variant="characterEditMode ? 'primary' : 'default'"
        label="Déplacer les personnages sur la carte"
        @click="$emit('toggle-character-edit')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M2 12h20" />
          <path d="M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
        </svg>
      </ToolbarButton>
      <!-- Le bouton de mode édition des POI a rejoint le pied de sidebar (#66) :
           il y côtoie les autres actions de création. Cette barre garde ce qui
           pilote l'affichage de la carte elle-même, et le déplacement des pins
           personnages (#88), qui ne se joue que sur la carte. -->
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
/* Plus de translate de recentrage : c'est iconAnchor qui ancre le repère
   (#81). Le marqueur remplit exactement la boîte que Leaflet a dimensionnée
   avec iconSize, donc la boîte du glyphe. */
:deep(.poi-marker) {
  position: relative;
  width: 100%;
  height: 100%;
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
/* Hors du flux, à droite du repère : la boîte de l'icône ne doit dépendre que
   du glyphe. Dans le flux, l'étiquette élargissait la boîte, donc le repère se
   décalait d'une demi-largeur de nom et sautait dès que l'étiquette
   apparaissait au franchissement du seuil de zoom (#81). */
:deep(.poi-label) {
  position: absolute;
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}
:deep(.poi-marker.is-editable) {
  pointer-events: auto;
  cursor: grab;
}
/* Survolé depuis la liste (#54) : passe en doré et grossit, pour rester
   repérable même noyé au milieu des autres POI rouges.
   Plus de `z-index` ici : la règle portait sur l'enfant du wrapper Leaflet et
   n'a jamais rien fait, un enfant ne pouvant pas sortir son parent de l'ordre
   de ses frères. C'est setZIndexOffset() qui s'en charge (#82). */
:deep(.poi-marker.is-hovered) {
  color: var(--accent);
  font-size: 0.95rem;
}
:deep(.poi-marker.is-hovered .poi-glyph) {
  background: var(--accent);
}
/* Le repère double de taille au survol (#82). L'agrandissement porte sur le
   glyphe seul, par `scale` : la boîte de l'icône ne change pas, donc l'ancrage
   déclaré à Leaflet reste juste (#81), et l'étiquette garde sa taille. Origine
   au centre, c'est-à-dire sur l'ancre, sinon le repère glisserait en
   grossissant. */
:deep(.poi-glyph) {
  transition: transform var(--marker-grow-duration) ease;
}
:deep(.poi-marker.is-hovered .poi-glyph) {
  transform: scale(2);
  transform-origin: center;
}

/* L'icône du type remplace le point (#68). mask-image plutôt qu'un <img> :
   les PNG sont des silhouettes avec canal alpha, la teinte reste donc pilotée
   par --poi comme le reste des POI. L'URL du fichier et la TAILLE arrivent en
   variables inline depuis buildPoiMarkerHtml : la taille sert aussi à calculer
   l'ancrage donné à Leaflet, les deux ne peuvent donc plus diverger (#81). */
:deep(.poi-glyph) {
  position: absolute;
  inset: 0;
  width: var(--poi-size);
  height: var(--poi-size);
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
   des POI (#49). La taille du glyphe vient de --poi-size, seule l'étiquette
   se règle encore ici. */
:deep(.poi-marker.is-major) {
  font-size: 0.92rem;
}

:deep(.pin-icon-wrapper) {
  background: transparent;
  border: none;
}
/* Plus de translate de recentrage : l'ancrage est déclaré à Leaflet via
   iconAnchor, qui pointe la pointe de la queue (#81). Le pin remplit la boîte
   dimensionnée par iconSize. */
:deep(.pin) {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Étiquette au survol uniquement quand le curseur est précisément sur le
     cercle (CDC §5.1) : seul .pin__ring reçoit les événements pointeur. */
  pointer-events: none;
}
/* Le cercle et la queue, groupés pour être agrandis ensemble au survol (#82).
   L'origine est la pointe de la queue, c'est-à-dire l'ancre déclarée à Leaflet :
   le pin grossit vers le haut sans quitter son point. `scale` ne modifie pas la
   boîte, donc iconSize/iconAnchor restent valables (#81). L'étiquette est en
   dehors de ce groupe, elle ne double donc pas de taille. */
:deep(.pin__mark) {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: bottom center;
  transition: transform var(--marker-grow-duration) ease;
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
  pointer-events: auto;
  cursor: pointer;
}
:deep(.pin__ring img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Mode édition des personnages (#88) : le curseur annonce le glisser-déposer,
   sur les pins seuls. Pas de curseur sur le conteneur : cliquer le vide de la
   carte ne fait rien dans ce mode. Le cercle est la seule partie du pin qui
   reçoive les événements pointeur, donc la seule à pouvoir porter un curseur. */
:deep(.pin.is-editable .pin__ring) {
  cursor: grab;
}
:deep(.pin__tail) {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid var(--rel-inconnu);
  margin-top: -1px;
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
/* Le pin double de taille quand on le survole ou qu'il est sélectionné (#82).
   Auparavant il ne grossissait que de 12 %, trop discret pour retrouver un pin
   noyé dans un groupe. */
:deep(.pin__mark:hover),
:deep(.pin.is-active .pin__mark) {
  transform: scale(2);
}
/* Hors du flux, sous la pointe : dans le flux, l'étiquette allongeait la boîte
   et élargissait le pin à la longueur du nom, ce qui décalait l'ancrage
   différemment pour chaque personnage (#81). Elle est masquée par `opacity`,
   pas par `display`, donc elle occupait la place en permanence. */
:deep(.pin__label) {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
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
/* Le cercle vit désormais dans .pin__mark (#82), le sélecteur frère part donc
   du groupe et non plus du cercle. Le survol reste bien celui du cercle seul :
   .pin__mark n'a pas de `pointer-events`, il ne passe en :hover que parce que
   .pin__ring, lui, les reçoit (CDC §5.1). */
:deep(.pin__mark:hover ~ .pin__label),
:deep(.pin.is-active .pin__label) {
  opacity: 1;
}

/* Pendant un placement, les marqueurs sont transparents à la souris (#86) : le
   clic doit atteindre la carte pour poser la position, même pile sur un pin
   existant, et le crosshair du conteneur doit rester visible partout. Il faut
   neutraliser le wrapper Leaflet lui-même (leaflet.css rend chaque marqueur
   interactif via .leaflet-interactive) ET ses descendants, car .pin__ring et
   .poi-marker.is-editable réactivent leurs pointer-events. La double classe
   .map-container garantit de l'emporter sur ces règles indépendamment de
   l'ordre dans le fichier. L'état normal revient tout seul : la classe est
   pilotée par placementActive, y compris après une annulation. */
.map-container.map-container--placing :deep(.leaflet-marker-icon),
.map-container.map-container--placing :deep(.leaflet-marker-icon *) {
  pointer-events: none;
}
</style>
