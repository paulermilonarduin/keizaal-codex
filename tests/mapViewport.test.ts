import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ABSOLUTE_MIN_ZOOM,
  MAX_ZOOM,
  clampZoom,
  fitZoom,
  zoomAfterResize,
} from '../src/lib/mapViewport.ts'

const IMAGE = { width: 2048, height: 1536 }

describe('fitZoom', () => {
  test('conteneur exactement à la taille de l’image → zoom 0', () => {
    assert.equal(fitZoom({ width: 2048, height: 1536 }, IMAGE), 0)
  })

  test('conteneur deux fois plus grand → zoom 1, deux fois plus petit → zoom -1', () => {
    assert.equal(fitZoom({ width: 4096, height: 3072 }, IMAGE), 1)
    assert.equal(fitZoom({ width: 1024, height: 768 }, IMAGE), -1)
  })

  test('retient le plus contraignant des deux ratios (l’image doit tenir entière)', () => {
    // Large mais peu haut : c'est la hauteur qui contraint (768/1536 → -1).
    assert.equal(fitZoom({ width: 8192, height: 768 }, IMAGE), -1)
    // Haut mais peu large : c'est la largeur qui contraint (1024/2048 → -1).
    assert.equal(fitZoom({ width: 1024, height: 6144 }, IMAGE), -1)
  })

  test('conteneur nul → renvoie le plancher absolu plutôt que -Infinity', () => {
    assert.equal(fitZoom({ width: 0, height: 0 }, IMAGE), ABSOLUTE_MIN_ZOOM)
    assert.equal(fitZoom({ width: 800, height: 0 }, IMAGE), ABSOLUTE_MIN_ZOOM)
  })
})

describe('clampZoom', () => {
  test('borne aux limites de la carte', () => {
    assert.equal(clampZoom(-99), ABSOLUTE_MIN_ZOOM)
    assert.equal(clampZoom(99), MAX_ZOOM)
    assert.equal(clampZoom(1.5), 1.5)
  })
})

describe('zoomAfterResize', () => {
  test('au dézoom maximal, on suit le nouveau plancher (« je vois toute la carte » est une intention)', () => {
    assert.equal(zoomAfterResize(-1.09, -1.09, -0.5), -0.5)
    assert.equal(zoomAfterResize(-1.09, -1.09, -2), -2)
  })

  test('au-dessus du plancher, le zoom de l’utilisateur est préservé', () => {
    assert.equal(zoomAfterResize(2, -1.09, -0.5), 2)
  })

  test('sous le nouveau plancher, le zoom est relevé jusqu’à lui', () => {
    assert.equal(zoomAfterResize(-1.5, -2, -0.5), -0.5)
  })
})
