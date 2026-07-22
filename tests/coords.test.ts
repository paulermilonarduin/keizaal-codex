import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pixelToLatLng, latLngToPixel } from '../src/lib/coords.ts'

describe('pixelToLatLng', () => {
  test("l'origine image (0,0) correspond à latLng (0,0)", () => {
    assert.deepEqual(pixelToLatLng(0, 0), [0, 0])
  })

  test('x devient lng directement, y devient -lat (axe Y vers le bas)', () => {
    assert.deepEqual(pixelToLatLng(2450, 3100), [-3100, 2450])
  })
})

describe('latLngToPixel', () => {
  test('inverse de pixelToLatLng à l’origine', () => {
    assert.deepEqual(latLngToPixel(0, 0), { x: 0, y: 0 })
  })

  test('reconstitue les pixels d’origine', () => {
    assert.deepEqual(latLngToPixel(-3100, 2450), { x: 2450, y: 3100 })
  })
})

describe('round-trip pixel → latLng → pixel', () => {
  test('conserve les coordonnées pour plusieurs points', () => {
    const points: [number, number][] = [
      [0, 0],
      [2450, 3100],
      [4800, 300],
      [123.5, 987.25],
    ]
    for (const [x, y] of points) {
      const [lat, lng] = pixelToLatLng(x, y)
      assert.deepEqual(latLngToPixel(lat, lng), { x, y })
    }
  })
})
