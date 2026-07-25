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

describe('ui.store — onglets de la sidebar (#52)', () => {
  test('l’onglet Personnages est actif par défaut', () => {
    const ui = createUiStore()
    assert.equal(ui.activeTab.value, 'characters')
  })

  test('setActiveTab change la section affichée', () => {
    const ui = createUiStore()
    ui.setActiveTab('pois')
    assert.equal(ui.activeTab.value, 'pois')
  })

  test('sélectionner un pin ramène sur Personnages, sinon le surlignage serait invisible', () => {
    // Régression CDC §5.1 : le scrollIntoView de la carte du personnage ne peut
    // rien faire si la liste des personnages est démontée.
    const ui = createUiStore()
    ui.setActiveTab('groups')

    ui.selectPin('char-1', 'home')

    assert.equal(ui.activeTab.value, 'characters')
    assert.deepEqual(ui.selectedPin.value, { characterId: 'char-1', kind: 'home' })
  })

  test('chaque onglet garde sa propre recherche, indépendamment des autres', () => {
    const ui = createUiStore()
    ui.characterSearch.value = 'lydia'
    ui.groupSearch.value = 'compagnons'
    ui.poiSearch.value = 'blancherive'

    assert.equal(ui.characterSearch.value, 'lydia')
    assert.equal(ui.groupSearch.value, 'compagnons')
    assert.equal(ui.poiSearch.value, 'blancherive')
  })

  test('changer d’onglet ne réinitialise pas les recherches', () => {
    const ui = createUiStore()
    ui.characterSearch.value = 'lydia'
    ui.setActiveTab('pois')
    ui.setActiveTab('characters')
    assert.equal(ui.characterSearch.value, 'lydia')
  })
})

describe('ui.store — survol des POI (#54)', () => {
  test('aucun POI survolé au départ', () => {
    const ui = createUiStore()
    assert.equal(ui.hoveredPoiId.value, null)
  })

  test('setHoveredPoi désigne le POI à surligner sur la carte', () => {
    const ui = createUiStore()
    ui.setHoveredPoi('poi-1')
    assert.equal(ui.hoveredPoiId.value, 'poi-1')
  })

  test('setHoveredPoi(null) relâche le surlignage', () => {
    const ui = createUiStore()
    ui.setHoveredPoi('poi-1')
    ui.setHoveredPoi(null)
    assert.equal(ui.hoveredPoiId.value, null)
  })

  test('les survols personnage et POI sont indépendants', () => {
    const ui = createUiStore()
    ui.setHoveredCharacter('char-1')
    ui.setHoveredPoi('poi-1')

    assert.equal(ui.hoveredCharacterId.value, 'char-1')
    assert.equal(ui.hoveredPoiId.value, 'poi-1')
  })
})
