import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PIN_HEIGHT,
  PIN_RING_SIZE,
  PIN_WIDTH,
  pinIconGeometry,
} from '../src/components/map/pinIcon.ts'

// #81 : les pins glissaient au zoom parce que `L.divIcon` était créé sans
// iconSize ni iconAnchor. Leaflet n'écrit alors aucune marge de recentrage
// (cf. son _setIconStyles) et pose le coin haut-gauche du div sur le point ;
// l'ancrage était simulé en CSS par un translate en pourcentages, donc calculé
// sur une boîte qui incluait l'étiquette. Ces fonctions donnent à Leaflet la
// géométrie exacte, seule façon d'ancrer au pixel à tous les zooms.
describe('pinIconGeometry (#81)', () => {
  test('la boîte fait la largeur du cercle et la hauteur cercle + queue', () => {
    const { size } = pinIconGeometry()

    assert.deepEqual(size, [PIN_WIDTH, PIN_HEIGHT])
    assert.equal(size[0], PIN_RING_SIZE, 'le cercle est l’élément le plus large')
    assert.ok(size[1] > size[0], 'la queue ajoute de la hauteur sous le cercle')
  })

  test('l’ancre est la pointe de la queue : en bas, centrée horizontalement', () => {
    const { size, anchor } = pinIconGeometry()

    assert.equal(anchor[0], size[0] / 2)
    assert.equal(anchor[1], size[1], 'la pointe touche le bas de la boîte')
  })

  test('la géométrie ne dépend de rien : même ancre pour tous les pins', () => {
    // C'était le cœur du bug : l'ancre variait avec la longueur du nom, parce
    // que l'étiquette élargissait la boîte sur laquelle portait le translate.
    assert.deepEqual(pinIconGeometry(), pinIconGeometry())
  })

  // #82 : le pin survolé double de taille. L'agrandissement doit passer par un
  // `scale` CSS, qui ne touche pas à la boîte, et non par les dimensions : si
  // elles changeaient, iconSize/iconAnchor devraient être recalculés à chaque
  // survol et le pin se décalerait, rouvrant #81.
  test('la géométrie ne prend aucun état : le survol ne peut pas la changer', () => {
    assert.equal(pinIconGeometry.length, 0, 'aucun paramètre, donc rien d’état-dépendant')
  })

  test('les dimensions sont des entiers de pixels exploitables par Leaflet', () => {
    const { size, anchor } = pinIconGeometry()

    for (const value of [...size, ...anchor]) {
      assert.ok(Number.isFinite(value) && value > 0, `${value} doit être un pixel valide`)
    }
    assert.ok(Number.isInteger(size[0]) && Number.isInteger(size[1]))
  })
})
