import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Z_OFFSET_HOVERED,
  Z_OFFSET_NORMAL,
  Z_OFFSET_SELECTED,
  markerZOffset,
} from '../src/components/map/markerStacking.ts'

// #82 : Leaflet empile les marqueurs en écrivant un z-index sur le wrapper
// .leaflet-marker-icon, calculé depuis la latitude, donc le plus au sud passe
// devant. La règle CSS `.poi-marker.is-hovered { z-index: 1000 }` portait sur
// l'enfant du wrapper : un z-index sur un enfant ne peut pas sortir son parent
// de l'ordre de ses frères, elle n'a donc jamais rien fait. La bonne API est
// setZIndexOffset(), qui s'ajoute au z-index calculé par Leaflet.
describe('markerZOffset (#82)', () => {
  test('un marqueur ordinaire ne décale rien : Leaflet garde son ordre par latitude', () => {
    assert.equal(markerZOffset({ hovered: false, selected: false }), Z_OFFSET_NORMAL)
    assert.equal(Z_OFFSET_NORMAL, 0)
  })

  test('le survol passe devant tout le reste', () => {
    assert.equal(markerZOffset({ hovered: true, selected: false }), Z_OFFSET_HOVERED)
  })

  test('la sélection passe devant les marqueurs ordinaires', () => {
    assert.equal(markerZOffset({ hovered: false, selected: true }), Z_OFFSET_SELECTED)
  })

  // Le survol est une action en cours, la sélection un état qui dure : c'est le
  // marqueur qu'on désigne à l'instant qui doit être lisible.
  test('survolé et sélectionné à la fois : le survol l’emporte', () => {
    assert.equal(markerZOffset({ hovered: true, selected: true }), Z_OFFSET_HOVERED)
  })

  test('les paliers sont strictement ordonnés', () => {
    assert.ok(Z_OFFSET_HOVERED > Z_OFFSET_SELECTED)
    assert.ok(Z_OFFSET_SELECTED > Z_OFFSET_NORMAL)
  })

  // Leaflet ajoute l'offset à un z-index dérivé de la latitude en pixels, qui
  // peut atteindre plusieurs milliers au zoom maximum. Un palier trop faible
  // serait noyé : un marqueur au sud resterait devant un marqueur survolé situé
  // plus au nord.
  test('les paliers dominent l’écart de latitude de deux marqueurs voisins', () => {
    const ecartLatitudeRealiste = 400
    assert.ok(Z_OFFSET_SELECTED > ecartLatitudeRealiste)
    assert.ok(Z_OFFSET_HOVERED - Z_OFFSET_SELECTED > ecartLatitudeRealiste)
  })
})
