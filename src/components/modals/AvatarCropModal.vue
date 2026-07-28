<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import type { CropperResult } from 'vue-advanced-cropper'
import ModalShell from './ModalShell.vue'
import ToolbarButton from '../layout/ToolbarButton.vue'
import {
  cropSideFor,
  initialCoordinates,
  sliderValueFor,
  type CropBox,
  type Size,
} from '../../lib/avatarCrop.ts'

// Étape de recadrage entre le choix du fichier et resizeToWebp (#97) : cadre
// carré fixe, image déplaçable au glisser, zoom au slider. Toute la géométrie
// vit dans lib/avatarCrop.ts, ce composant ne fait que la brancher au cropper.
const props = defineProps<{ file: File }>()

const emit = defineEmits<{ cancel: []; apply: [Blob] }>()

const cropper = ref<InstanceType<typeof Cropper> | null>(null)
// Révoquée au démontage : une objectURL oubliée fuit (relevé dans #74).
const imageUrl = ref(URL.createObjectURL(props.file))
const imageSize = ref<Size>({ width: 0, height: 0 })
const zoom = ref(0)

// Le cadre reste carré et fixe dans la zone d'aperçu : c'est l'image qui bouge
// et se met à l'échelle dessous.
function stencilSize({ boundaries }: { boundaries: Size }): Size {
  const side = Math.min(boundaries.width, boundaries.height) - 24
  return { width: side, height: side }
}

function defaultSize({ imageSize: size }: { imageSize: Size }): Size {
  const { width, height } = initialCoordinates(size)
  return { width, height }
}

function defaultPosition({ imageSize: size }: { imageSize: Size }): { left: number; top: number } {
  const { left, top } = initialCoordinates(size)
  return { left, top }
}

// setCoordinates plutôt que zoom() : une cible absolue n'accumule pas d'erreur
// d'arrondi slider après slider. Le redimensionnement d'abord, le recentrage
// ensuite, sinon la lib recentre sur l'ancienne taille.
function applyCropBox(box: CropBox): void {
  cropper.value?.setCoordinates([
    { width: box.width, height: box.height },
    { left: box.left, top: box.top },
  ])
}

function onZoomInput(event: Event): void {
  const instance = cropper.value
  if (instance === null) return
  const value = Number((event.target as HTMLInputElement).value)
  const current = instance.getResult().coordinates
  const side = cropSideFor(value, imageSize.value)
  // Zoom autour du centre du cadrage courant ; les bords sont clampés par la lib.
  applyCropBox({
    left: current.left + current.width / 2 - side / 2,
    top: current.top + current.height / 2 - side / 2,
    width: side,
    height: side,
  })
}

// Glisser et molette changent le cadrage sans passer par le slider : le
// resynchroniser, sinon il mentirait sur le zoom réel.
function onCropperChange(result: CropperResult): void {
  imageSize.value = { width: result.image.width, height: result.image.height }
  zoom.value = sliderValueFor(result.coordinates.height, imageSize.value)
}

function reset(): void {
  applyCropBox(initialCoordinates(imageSize.value))
}

// PNG et non WebP : format intermédiaire sans perte, resizeToWebp compresse
// ensuite une seule fois.
async function apply(): Promise<void> {
  const canvas = cropper.value?.getResult().canvas
  if (canvas === undefined) return
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob !== null) emit('apply', blob)
}

// Échap en phase de capture : le ModalShell de la fiche personnage écoute lui
// aussi keydown sur document, sans ce stopPropagation un Échap pendant le
// recadrage fermerait aussi la fiche et perdrait la saisie.
function onKeydownCapture(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydownCapture, { capture: true }))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydownCapture, { capture: true })
  URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <ModalShell @close="$emit('cancel')">
    <template #title>Recadrer l'image</template>

    <Cropper
      ref="cropper"
      class="cropper"
      :src="imageUrl"
      image-restriction="stencil"
      default-boundaries="fill"
      :stencil-size="stencilSize"
      :stencil-props="{
        aspectRatio: 1,
        movable: false,
        resizable: false,
        handlers: {},
        lines: {},
      }"
      :default-size="defaultSize"
      :default-position="defaultPosition"
      :transitions="false"
      :debounce="false"
      @change="onCropperChange"
    />

    <div class="zoom">
      <label for="avatarCropZoom">Zoom</label>
      <input
        id="avatarCropZoom"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="zoom"
        @input="onZoomInput"
      />
    </div>

    <template #footer>
      <ToolbarButton label="Réinitialiser" @click="reset()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12a8 8 0 1 0 3-6.2" />
          <path d="M4 4v4h4" />
        </svg>
      </ToolbarButton>
      <div class="right">
        <ToolbarButton label="Annuler" @click="$emit('cancel')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton variant="primary" label="Appliquer" @click="apply()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </ToolbarButton>
      </div>
    </template>
  </ModalShell>
</template>

<style scoped>
.cropper {
  /* default-boundaries="fill" plus une taille imposée ici : sinon la zone
     d'aperçu prend la taille de l'image et débordait de la modale. */
  width: 100%;
  /* min-width: 0 sinon la grille de la modale s'élargit à la taille de l'image. */
  min-width: 0;
  height: 300px;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
/* Thème par défaut de la librairie : fond clair et liseré blanc, remplacés par
   la palette du codex. :deep() car ces éléments appartiennent au cropper. */
.cropper :deep(.vue-advanced-cropper__background),
.cropper :deep(.vue-advanced-cropper__foreground) {
  background: var(--bg);
}
.cropper :deep(.vue-simple-handler) {
  display: none;
}
.cropper :deep(.vue-rectangle-stencil) {
  cursor: default;
}
.cropper :deep(.vue-simple-line) {
  border-color: var(--accent);
}

.zoom {
  display: flex;
  align-items: center;
  gap: 10px;
}
.zoom label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.zoom input {
  flex: 1;
  accent-color: var(--accent);
}

.right {
  display: flex;
  gap: 8px;
}
</style>
