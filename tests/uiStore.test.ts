import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createUiStore } from '../src/stores/ui.store.ts'

describe('ui.store — mode placement (CDC §5.1/§5.3, ARCHITECTURE.md §5.5)', () => {
  test('startPlacement ferme la modale et mémorise kind/draft/cible', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')

    ui.startPlacement('home', { name: 'Lydia' })

    assert.equal(ui.characterModalTarget.value, null)
    assert.deepEqual(ui.placement.value, {
      kind: 'home',
      draft: { name: 'Lydia' },
      modalTarget: 'char-1',
    })
  })

  test('fonctionne aussi depuis la création (cible « new »)', () => {
    const ui = createUiStore()
    ui.openNewCharacter()

    ui.startPlacement('known', { name: 'Bjorn' })

    assert.equal(ui.characterModalTarget.value, null)
    assert.equal(ui.placement.value?.modalTarget, 'new')
  })

  test('sans modale ouverte, ne fait rien', () => {
    const ui = createUiStore()
    ui.startPlacement('home', { name: 'Lydia' })
    assert.equal(ui.placement.value, null)
  })

  test('completePlacement rouvre la modale sur la même cible avec le résultat', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement('known', { name: 'Bjorn' })

    ui.completePlacement(120, 340, 'Blancherive')

    assert.equal(ui.characterModalTarget.value, 'char-1')
    assert.equal(ui.placement.value, null)
    assert.deepEqual(ui.placementResult.value, {
      draft: { name: 'Bjorn' },
      update: { kind: 'known', position: { x: 120, y: 340, label: 'Blancherive' } },
    })
  })

  test('sans placement en cours, ne fait rien', () => {
    const ui = createUiStore()
    ui.completePlacement(1, 2, undefined)
    assert.equal(ui.placementResult.value, null)
  })

  test('cancelPlacement rouvre la modale telle quelle, brouillon restauré sans changement de position', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement('home', { name: 'Lydia', role: 'Marchande' })

    ui.cancelPlacement()

    assert.equal(ui.characterModalTarget.value, 'char-1')
    assert.equal(ui.placement.value, null)
    assert.deepEqual(ui.placementResult.value, { draft: { name: 'Lydia', role: 'Marchande' } })
  })

  test('closeCharacterModal efface un résultat de placement en attente', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement('home', { name: 'Lydia' })
    ui.completePlacement(1, 2, undefined)

    ui.closeCharacterModal()

    assert.equal(ui.placementResult.value, null)
  })
})
