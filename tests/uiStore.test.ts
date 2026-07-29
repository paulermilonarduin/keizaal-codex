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
})

// Même patron que la modale personnage : 'new' à la création, un id en édition,
// null fermée (#83).
describe('ui.store — modale et recherche des histoires (#83)', () => {
  test('aucune modale d’histoire ouverte au départ', () => {
    assert.equal(createUiStore().storyModalTarget.value, null)
  })

  test('openNewStory ouvre la modale en création', () => {
    const ui = createUiStore()
    ui.openNewStory()
    assert.equal(ui.storyModalTarget.value, 'new')
  })

  test('openEditStory ouvre la modale sur une histoire existante', () => {
    const ui = createUiStore()
    ui.openEditStory('story-1')
    assert.equal(ui.storyModalTarget.value, 'story-1')
  })

  test('closeStoryModal referme la modale', () => {
    const ui = createUiStore()
    ui.openEditStory('story-1')
    ui.closeStoryModal()
    assert.equal(ui.storyModalTarget.value, null)
  })

  test('l’onglet Histoires a sa propre recherche, vide au départ', () => {
    const ui = createUiStore()
    assert.equal(ui.storySearch.value, '')

    ui.storySearch.value = 'siège'
    ui.characterSearch.value = 'lydia'

    assert.equal(ui.storySearch.value, 'siège')
    assert.equal(ui.characterSearch.value, 'lydia')
  })
})

// Même patron que les histoires : 'new' à la création, un id en édition, null
// fermée (#113).
describe('ui.store — modale de groupe (#113)', () => {
  test('aucune modale de groupe ouverte au départ', () => {
    assert.equal(createUiStore().groupModalTarget.value, null)
  })

  test('openNewGroup ouvre la modale en création', () => {
    const ui = createUiStore()
    ui.openNewGroup()
    assert.equal(ui.groupModalTarget.value, 'new')
  })

  test('openEditGroup ouvre la modale sur un groupe existant', () => {
    const ui = createUiStore()
    ui.openEditGroup('group-1')
    assert.equal(ui.groupModalTarget.value, 'group-1')
  })

  test('closeGroupModal referme la modale', () => {
    const ui = createUiStore()
    ui.openEditGroup('group-1')
    ui.closeGroupModal()
    assert.equal(ui.groupModalTarget.value, null)
  })
})

describe('ui.store — mode édition des personnages (#88)', () => {
  test('le mode est inactif par défaut', () => {
    assert.equal(createUiStore().characterEditMode.value, false)
  })

  test('toggleCharacterEditMode bascule le mode', () => {
    const ui = createUiStore()

    ui.toggleCharacterEditMode()
    assert.equal(ui.characterEditMode.value, true)

    ui.toggleCharacterEditMode()
    assert.equal(ui.characterEditMode.value, false)
  })

  // Les deux modes d'édition sont exclusifs : sur la carte, des pins déplaçables
  // et un clic qui crée un POI ne peuvent pas cohabiter sans ambiguïté.
  test('activer l’édition des personnages coupe l’édition des POI', () => {
    const ui = createUiStore()
    ui.togglePoiEditMode()

    ui.toggleCharacterEditMode()

    assert.equal(ui.poiEditMode.value, false)
    assert.equal(ui.characterEditMode.value, true)
  })

  test('activer l’édition des POI coupe l’édition des personnages', () => {
    const ui = createUiStore()
    ui.toggleCharacterEditMode()

    ui.togglePoiEditMode()

    assert.equal(ui.characterEditMode.value, false)
    assert.equal(ui.poiEditMode.value, true)
  })

  test('désactiver un mode ne réactive pas l’autre', () => {
    const ui = createUiStore()
    ui.toggleCharacterEditMode()

    ui.toggleCharacterEditMode()

    assert.equal(ui.characterEditMode.value, false)
    assert.equal(ui.poiEditMode.value, false)
  })

  // La mini-fiche est ancrée à la position du pin : après un déplacement elle
  // resterait plantée sur l'ancienne. En mode édition, le clic ne l'ouvre plus,
  // celle déjà ouverte doit donc se fermer à l'activation.
  test('activer le mode ferme la mini-fiche ouverte', () => {
    const ui = createUiStore()
    ui.selectPin('char-1')

    ui.toggleCharacterEditMode()

    assert.equal(ui.selectedCharacterId.value, null)
  })
})

describe('ui.store — mode déplacement des POI (#99)', () => {
  test('le mode est inactif par défaut', () => {
    assert.equal(createUiStore().poiMoveMode.value, false)
  })

  test('togglePoiMoveMode bascule le mode', () => {
    const ui = createUiStore()

    ui.togglePoiMoveMode()
    assert.equal(ui.poiMoveMode.value, true)

    ui.togglePoiMoveMode()
    assert.equal(ui.poiMoveMode.value, false)
  })

  // Les trois modes de carte restent mutuellement exclusifs : déplacer un POI,
  // en créer un au clic et déplacer un pin ne peuvent pas cohabiter sans
  // ambiguïté sur ce que fait le prochain geste.
  test('activer le déplacement des POI coupe l’édition des POI', () => {
    const ui = createUiStore()
    ui.togglePoiEditMode()

    ui.togglePoiMoveMode()

    assert.equal(ui.poiEditMode.value, false)
    assert.equal(ui.poiMoveMode.value, true)
  })

  test('activer le déplacement des POI coupe l’édition des personnages', () => {
    const ui = createUiStore()
    ui.toggleCharacterEditMode()

    ui.togglePoiMoveMode()

    assert.equal(ui.characterEditMode.value, false)
    assert.equal(ui.poiMoveMode.value, true)
  })

  test('activer l’édition des POI coupe le déplacement des POI', () => {
    const ui = createUiStore()
    ui.togglePoiMoveMode()

    ui.togglePoiEditMode()

    assert.equal(ui.poiMoveMode.value, false)
    assert.equal(ui.poiEditMode.value, true)
  })

  test('activer l’édition des personnages coupe le déplacement des POI', () => {
    const ui = createUiStore()
    ui.togglePoiMoveMode()

    ui.toggleCharacterEditMode()

    assert.equal(ui.poiMoveMode.value, false)
    assert.equal(ui.characterEditMode.value, true)
  })

  test('désactiver le mode ne réactive pas les autres', () => {
    const ui = createUiStore()
    ui.togglePoiMoveMode()

    ui.togglePoiMoveMode()

    assert.equal(ui.poiMoveMode.value, false)
    assert.equal(ui.poiEditMode.value, false)
    assert.equal(ui.characterEditMode.value, false)
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
