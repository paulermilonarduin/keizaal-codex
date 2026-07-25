import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { SIDEBAR_TABS, SIDEBAR_TAB_LABELS, nextTab } from '../src/lib/sidebarTabs.ts'

describe('SIDEBAR_TABS', () => {
  test('les trois sections, dans l’ordre des intercalaires', () => {
    assert.deepEqual([...SIDEBAR_TABS], ['characters', 'groups', 'pois'])
  })

  test('chaque onglet a un libellé (exhaustivité garantie par le type Record)', () => {
    for (const tab of SIDEBAR_TABS) {
      assert.ok(SIDEBAR_TAB_LABELS[tab].length > 0, `libellé manquant pour ${tab}`)
    }
  })
})

describe('nextTab', () => {
  test('avance et recule d’un onglet', () => {
    assert.equal(nextTab('characters', 'next'), 'groups')
    assert.equal(nextTab('groups', 'next'), 'pois')
    assert.equal(nextTab('pois', 'previous'), 'groups')
  })

  test('boucle aux extrémités (pattern ARIA tabs)', () => {
    assert.equal(nextTab('pois', 'next'), 'characters')
    assert.equal(nextTab('characters', 'previous'), 'pois')
  })

  test('first et last vont aux extrémités (touches Origine/Fin)', () => {
    assert.equal(nextTab('groups', 'first'), 'characters')
    assert.equal(nextTab('groups', 'last'), 'pois')
    assert.equal(nextTab('characters', 'first'), 'characters')
  })
})
