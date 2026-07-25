import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterPois } from '../src/lib/filterPois.ts'
import type { Poi } from '../shared/schemas.ts'
import type { PoiType } from '../shared/enums.ts'

function poi(name: string, type: PoiType = 'landmark'): Poi {
  return { id: name.toLowerCase(), name, type, x: 0, y: 0 }
}

const NO_FILTER = { search: '', type: null }

describe('filterPois', () => {
  it('trie par nom en français', () => {
    const result = filterPois([poi('Épervine'), poi('Blancherive'), poi('Aubétoile')], NO_FILTER)

    assert.deepEqual(
      result.map((p) => p.name),
      ['Aubétoile', 'Blancherive', 'Épervine'],
    )
  })

  it('filtre par nom sans tenir compte de la casse ni des accents', () => {
    const result = filterPois([poi('Épervine'), poi('Blancherive')], {
      ...NO_FILTER,
      search: 'eperv',
    })

    assert.deepEqual(
      result.map((p) => p.name),
      ['Épervine'],
    )
  })

  it('filtre par type', () => {
    const pois = [poi('Blancherive', 'capitale'), poi('Rivebois', 'village'), poi('Fellune', 'mine')]

    const result = filterPois(pois, { ...NO_FILTER, type: 'village' })

    assert.deepEqual(
      result.map((p) => p.name),
      ['Rivebois'],
    )
  })

  it('combine recherche et type', () => {
    const pois = [
      poi('Grotte de Corbeaubois', 'cave'),
      poi('Grotte de Bleucreux', 'cave'),
      poi('Mine de Corbeaubois', 'mine'),
    ]

    const result = filterPois(pois, { search: 'corbeau', type: 'cave' })

    assert.deepEqual(
      result.map((p) => p.name),
      ['Grotte de Corbeaubois'],
    )
  })

  it('ignore les espaces autour du terme recherché', () => {
    const result = filterPois([poi('Blancherive'), poi('Rivebois')], {
      ...NO_FILTER,
      search: '  rive  ',
    })

    assert.deepEqual(
      result.map((p) => p.name).sort(),
      ['Blancherive', 'Rivebois'],
    )
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    assert.deepEqual(filterPois([poi('Blancherive')], { ...NO_FILTER, search: 'zzz' }), [])
  })

  it('ne modifie pas le tableau reçu', () => {
    const pois = [poi('Épervine'), poi('Aubétoile')]

    filterPois(pois, NO_FILTER)

    assert.deepEqual(
      pois.map((p) => p.name),
      ['Épervine', 'Aubétoile'],
    )
  })
})
