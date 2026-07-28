import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeAction, mapContainerClasses } from '../src/components/map/placementMode.ts'

describe('mapContainerClasses', () => {
  test('hors placement : la classe de base seule', () => {
    assert.deepEqual(mapContainerClasses(false), ['map-container'])
  })

  // #86 : le placement est un mode modal. Le modificateur porte la règle CSS
  // qui rend les marqueurs transparents à la souris (ni curseur, ni survol,
  // ni clic), pour que le clic atteigne la carte et pose la position, même
  // pile sur un pin existant.
  test('pendant un placement : ajoute le modificateur de transparence', () => {
    assert.deepEqual(mapContainerClasses(true), ['map-container', 'map-container--placing'])
  })
})

describe('escapeAction', () => {
  test('placement actif : Échap annule le placement', () => {
    assert.equal(escapeAction({ placementActive: true, popupOpen: false }), 'cancel-placement')
  })

  // Critère #86 : même avec une mini-fiche ouverte, Échap doit annuler le
  // placement, pas fermer la mini-fiche.
  test('placement actif et mini-fiche ouverte : le placement prime', () => {
    assert.equal(escapeAction({ placementActive: true, popupOpen: true }), 'cancel-placement')
  })

  test('mini-fiche ouverte sans placement : Échap la ferme', () => {
    assert.equal(escapeAction({ placementActive: false, popupOpen: true }), 'close-popup')
  })

  test('ni placement ni mini-fiche : Échap ne fait rien', () => {
    assert.equal(escapeAction({ placementActive: false, popupOpen: false }), null)
  })
})
