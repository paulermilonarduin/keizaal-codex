import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_PAN_DURATION_S,
  MIN_PAN_DURATION_S,
  PAN_EASE_LINEARITY,
  createCenteringController,
  panDuration,
} from '../src/lib/mapCentering.ts'
import type { CenterPoint, CenteringPort } from '../src/lib/mapCentering.ts'

type PanCall = { target: CenterPoint; options: { duration: number; easeLinearity: number } }

// Port factice : enregistre les appels, la distance est stubbée puisque c'est
// Leaflet qui la mesure en vrai.
function createFakePort(distance: number): {
  port: CenteringPort
  pans: PanCall[]
  snaps: CenterPoint[]
} {
  const pans: PanCall[] = []
  const snaps: CenterPoint[] = []
  return {
    pans,
    snaps,
    port: {
      distanceTo: () => distance,
      panTo: (target, options) => {
        pans.push({ target, options })
      },
      snapTo: (target) => {
        snaps.push(target)
      },
    },
  }
}

describe('panDuration', () => {
  test('petite distance : plancher, pour que le mouvement reste perceptible', () => {
    assert.equal(panDuration(10), MIN_PAN_DURATION_S)
    assert.equal(panDuration(0), MIN_PAN_DURATION_S)
  })

  test('très grande distance : plafond, une traversée de carte ne doit pas traîner', () => {
    assert.equal(panDuration(50000), MAX_PAN_DURATION_S)
  })

  test('entre les deux bornes : proportionnel à la distance', () => {
    assert.equal(panDuration(1000), 0.5)
  })
})

describe('createCenteringController', () => {
  test('centerOn transmet la cible avec la courbe et la durée attendues', () => {
    const { port, pans } = createFakePort(1000)
    const controller = createCenteringController(port)

    controller.centerOn({ x: 120, y: 340 })

    assert.equal(pans.length, 1)
    assert.deepEqual(pans[0]?.target, { x: 120, y: 340 })
    assert.equal(pans[0]?.options.easeLinearity, PAN_EASE_LINEARITY)
    assert.equal(pans[0]?.options.duration, panDuration(1000))
  })

  test('deux focalisations rapprochées : le recalage vise la dernière cible', () => {
    const { port, pans, snaps } = createFakePort(1000)
    const controller = createCenteringController(port)

    controller.centerOn({ x: 10, y: 10 })
    controller.centerOn({ x: 900, y: 500 })
    controller.handleResize()

    assert.equal(pans.length, 2)
    assert.deepEqual(snaps, [{ x: 900, y: 500 }])
  })

  test('redimensionnement pendant l’animation : un seul snap sur la cible', () => {
    const { port, snaps } = createFakePort(1000)
    const controller = createCenteringController(port)

    controller.centerOn({ x: 42, y: 84 })
    controller.handleResize()
    controller.handleResize()

    assert.deepEqual(snaps, [{ x: 42, y: 84 }])
  })

  test('arrivée puis redimensionnement : aucun recentrage sur une vieille cible', () => {
    const { port, snaps } = createFakePort(1000)
    const controller = createCenteringController(port)

    controller.centerOn({ x: 42, y: 84 })
    controller.handleMoveEnd()
    controller.handleResize()

    assert.deepEqual(snaps, [])
  })

  test('déjà centré : rien à recaler plus tard', () => {
    const { port, snaps } = createFakePort(0)
    const controller = createCenteringController(port)

    controller.centerOn({ x: 42, y: 84 })
    controller.handleResize()

    assert.deepEqual(snaps, [])
  })

  test('le moveend synchrone émis par l’arrêt de l’animation précédente ne désarme pas la nouvelle cible', () => {
    // Leaflet appelle _stop() en entrée de setView/panTo, ce qui émet un
    // moveend SYNCHRONE à la position intermédiaire : il arrive donc pendant
    // l'appel panTo du nouveau centrage.
    const pans: CenterPoint[] = []
    const snaps: CenterPoint[] = []
    let controller: ReturnType<typeof createCenteringController> | null = null
    const port: CenteringPort = {
      distanceTo: () => 1000,
      panTo: (target) => {
        pans.push(target)
        controller?.handleMoveEnd()
      },
      snapTo: (target) => {
        snaps.push(target)
      },
    }
    controller = createCenteringController(port)

    controller.centerOn({ x: 10, y: 10 })
    controller.centerOn({ x: 900, y: 500 })
    controller.handleResize()

    assert.equal(pans.length, 2)
    assert.deepEqual(snaps, [{ x: 900, y: 500 }])
  })
})
