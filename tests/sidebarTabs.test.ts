import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { SIDEBAR_TABS, SIDEBAR_TAB_LABELS, nextTab } from '../src/lib/sidebarTabs.ts'

describe('SIDEBAR_TABS', () => {
  test('les quatre sections, dans l’ordre des intercalaires', () => {
    assert.deepEqual([...SIDEBAR_TABS], ['characters', 'groups', 'pois', 'stories'])
  })

  test('chaque onglet a un libellé (exhaustivité garantie par le type Record)', () => {
    for (const tab of SIDEBAR_TABS) {
      assert.ok(SIDEBAR_TAB_LABELS[tab].length > 0, `libellé manquant pour ${tab}`)
    }
  })

  test('les histoires s’intitulent « Histoires » (#83)', () => {
    assert.equal(SIDEBAR_TAB_LABELS.stories, 'Histoires')
  })
})

describe('nextTab', () => {
  test('avance et recule d’un onglet', () => {
    assert.equal(nextTab('characters', 'next'), 'groups')
    assert.equal(nextTab('groups', 'next'), 'pois')
    assert.equal(nextTab('pois', 'next'), 'stories')
    assert.equal(nextTab('stories', 'previous'), 'pois')
  })

  test('boucle aux extrémités (pattern ARIA tabs)', () => {
    assert.equal(nextTab('stories', 'next'), 'characters')
    assert.equal(nextTab('characters', 'previous'), 'stories')
  })

  test('first et last vont aux extrémités (touches Origine/Fin)', () => {
    assert.equal(nextTab('groups', 'first'), 'characters')
    assert.equal(nextTab('groups', 'last'), 'stories')
    assert.equal(nextTab('characters', 'first'), 'characters')
  })
})
