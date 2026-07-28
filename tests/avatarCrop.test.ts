import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cropSideFor,
  initialCoordinates,
  initialCropSide,
  minCropSide,
  sliderValueFor,
} from '../src/lib/avatarCrop.ts'

// Géométrie pure du recadrage (#97) : la modale de crop délègue tout le calcul
// ici pour rester testable sans DOM ni librairie de cropping.

describe('initialCropSide', () => {
  test('image paysage : le carré couvre la hauteur', () => {
    assert.equal(initialCropSide({ width: 400, height: 300 }), 300)
  })

  test('image portrait : le carré couvre la largeur', () => {
    assert.equal(initialCropSide({ width: 300, height: 500 }), 300)
  })

  test('image carrée : le carré couvre tout', () => {
    assert.equal(initialCropSide({ width: 256, height: 256 }), 256)
  })
})

describe('minCropSide', () => {
  test('grande image : 1/10 du cadrage initial', () => {
    assert.equal(minCropSide({ width: 4000, height: 3000 }), 300)
  })

  // 3000 / 10 = 300 px de côté, largement au-dessus du plancher.

  test('image moyenne : plancher de 32px', () => {
    // 200 / 10 = 20 px : trop petit pour rester exploitable après resize.
    assert.equal(minCropSide({ width: 200, height: 200 }), 32)
  })

  test('image minuscule : jamais plus grand que le cadrage initial', () => {
    assert.equal(minCropSide({ width: 24, height: 24 }), 24)
  })
})

describe('initialCoordinates', () => {
  test('paysage : carré centré horizontalement', () => {
    assert.deepEqual(initialCoordinates({ width: 400, height: 300 }), {
      left: 50,
      top: 0,
      width: 300,
      height: 300,
    })
  })

  test('portrait : carré centré verticalement', () => {
    assert.deepEqual(initialCoordinates({ width: 300, height: 500 }), {
      left: 0,
      top: 100,
      width: 300,
      height: 300,
    })
  })
})

describe('cropSideFor / sliderValueFor', () => {
  const image = { width: 4000, height: 3000 }

  test('slider à 0 : cadrage initial', () => {
    assert.equal(cropSideFor(0, image), initialCropSide(image))
  })

  test('slider à 1 : zoom max', () => {
    assert.equal(cropSideFor(1, image), minCropSide(image))
  })

  // Les deux fonctions doivent rester réciproques, sinon le slider saute à
  // chaque resynchronisation après un drag.
  test('réciprocité au milieu du slider', () => {
    const value = sliderValueFor(cropSideFor(0.5, image), image)

    assert.ok(Math.abs(value - 0.5) < 1e-9, `attendu ~0.5, reçu ${value}`)
  })

  test('clamp haut et bas', () => {
    assert.equal(sliderValueFor(initialCropSide(image) * 2, image), 0)
    assert.equal(sliderValueFor(minCropSide(image) / 2, image), 1)
    assert.equal(cropSideFor(-0.5, image), initialCropSide(image))
    assert.equal(cropSideFor(1.5, image), minCropSide(image))
  })

  // Sur une image plus petite que le plancher, min === initial : la division
  // par l'amplitude vaudrait 0/0.
  test('image sans marge de zoom : pas de NaN', () => {
    assert.equal(sliderValueFor(24, { width: 24, height: 24 }), 0)
  })
})
