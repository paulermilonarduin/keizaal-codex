import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createUiStore } from '../src/stores/ui.store.ts'

describe('ui.store — mode placement (CDC §5.1/§5.3, ARCHITECTURE.md §5.5)', () => {
  test('startPlacement ferme la modale et mémorise le brouillon et la cible', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')

    ui.startPlacement({ name: 'Lydia' })

    assert.equal(ui.characterModalTarget.value, null)
    assert.deepEqual(ui.placement.value, {
      draft: { name: 'Lydia' },
      modalTarget: 'char-1',
    })
  })

  test('fonctionne aussi depuis la création (cible « new »)', () => {
    const ui = createUiStore()
    ui.openNewCharacter()

    ui.startPlacement({ name: 'Bjorn' })

    assert.equal(ui.characterModalTarget.value, null)
    assert.equal(ui.placement.value?.modalTarget, 'new')
  })

  test('sans modale ouverte, ne fait rien', () => {
    const ui = createUiStore()
    ui.startPlacement({ name: 'Lydia' })
    assert.equal(ui.placement.value, null)
  })

  test('completePlacement rouvre la modale sur la même cible avec le résultat', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement({ name: 'Bjorn' })

    ui.completePlacement(120, 340)

    assert.equal(ui.characterModalTarget.value, 'char-1')
    assert.equal(ui.placement.value, null)
    assert.deepEqual(ui.placementResult.value, {
      draft: { name: 'Bjorn' },
      // Plus de libellé : il était emprunté au POI le plus proche (#78).
      update: { position: { x: 120, y: 340 } },
    })
  })

  test('sans placement en cours, ne fait rien', () => {
    const ui = createUiStore()
    ui.completePlacement(1, 2)
    assert.equal(ui.placementResult.value, null)
  })

  test('cancelPlacement rouvre la modale telle quelle, brouillon restauré sans changement de position', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement({ name: 'Lydia', role: 'Marchande' })

    ui.cancelPlacement()

    assert.equal(ui.characterModalTarget.value, 'char-1')
    assert.equal(ui.placement.value, null)
    assert.deepEqual(ui.placementResult.value, { draft: { name: 'Lydia', role: 'Marchande' } })
  })

  test('closeCharacterModal efface un résultat de placement en attente', () => {
    const ui = createUiStore()
    ui.openEditCharacter('char-1')
    ui.startPlacement({ name: 'Lydia' })
    ui.completePlacement(1, 2)

    ui.closeCharacterModal()

    assert.equal(ui.placementResult.value, null)
  })
})

// #80 : une seule position par personnage, donc un seul pin et un seul toggle.
describe('ui.store : visibilité des pins (#80)', () => {
  test('les pins sont visibles au départ', () => {
    assert.equal(createUiStore().showPins.value, true)
  })

  test('togglePins bascule l’affichage', () => {
    const ui = createUiStore()

    ui.togglePins()
    assert.equal(ui.showPins.value, false)

    ui.togglePins()
    assert.equal(ui.showPins.value, true)
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

    ui.selectPin('char-1')

    assert.equal(ui.activeTab.value, 'characters')
    assert.equal(ui.selectedCharacterId.value, 'char-1')
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

// Le pied de sidebar est commun aux trois onglets (#66) : ses actions doivent
// donc rester utilisables sans quitter l'onglet courant.
describe('ui.store — actions globales depuis n’importe quel onglet (#66)', () => {
  test('le mode édition des POI s’active depuis l’onglet Groupes', () => {
    const ui = createUiStore()
    ui.setActiveTab('groups')

    ui.togglePoiEditMode()

    assert.equal(ui.poiEditMode.value, true)
    // L'onglet ne bouge pas : on place un POI sur la carte, la liste affichée
    // à gauche n'a aucune raison de changer.
    assert.equal(ui.activeTab.value, 'groups')
  })

  test('changer d’onglet ne coupe pas le mode édition des POI en cours', () => {
    const ui = createUiStore()
    ui.togglePoiEditMode()

    ui.setActiveTab('pois')
    ui.setActiveTab('characters')

    assert.equal(ui.poiEditMode.value, true)
  })

  test('la modale personnage s’ouvre depuis l’onglet Points d’intérêt', () => {
    const ui = createUiStore()
    ui.setActiveTab('pois')

    ui.openNewCharacter()

    assert.equal(ui.characterModalTarget.value, 'new')
    assert.equal(ui.activeTab.value, 'pois')
  })

  test('la modale Groupes s’ouvre depuis l’onglet Points d’intérêt', () => {
    const ui = createUiStore()
    ui.setActiveTab('pois')

    ui.openGroupsModal()

    assert.equal(ui.groupsModalOpen.value, true)
    assert.equal(ui.activeTab.value, 'pois')
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
