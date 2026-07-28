import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterStories } from '../src/lib/filterStories.ts'
import type { Story } from '../shared/schemas.ts'

function story(title: string, extra: Partial<Story> = {}): Story {
  return {
    id: title.toLowerCase(),
    title,
    notes: '',
    characters: [],
    groups: [],
    pois: [],
    ...extra,
  }
}

describe('filterStories', () => {
  it('trie par titre en français, indépendamment de l’ordre d’entrée', () => {
    const result = filterStories([story('Épilogue'), story('Le siège'), story('Aube rouge')], '')

    assert.deepEqual(
      result.map((s) => s.title),
      ['Aube rouge', 'Épilogue', 'Le siège'],
    )
  })

  it('filtre par titre sans tenir compte de la casse ni des accents', () => {
    const result = filterStories([story('Épilogue'), story('Le siège')], 'epilo')

    assert.deepEqual(
      result.map((s) => s.title),
      ['Épilogue'],
    )
  })

  it('cherche aussi dans les notes', () => {
    const stories = [
      story('Le siège', { notes: 'Une nuit de feu à Blancherive' }),
      story('Épilogue', { notes: 'Retour à Solitude' }),
    ]

    const result = filterStories(stories, 'blancherive')

    assert.deepEqual(
      result.map((s) => s.title),
      ['Le siège'],
    )
  })

  it('ignore les espaces autour du terme recherché', () => {
    const result = filterStories([story('Le siège'), story('Épilogue')], '  siege  ')

    assert.deepEqual(
      result.map((s) => s.title),
      ['Le siège'],
    )
  })

  it('renvoie tout quand la recherche est vide', () => {
    assert.equal(filterStories([story('Le siège'), story('Épilogue')], '   ').length, 2)
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    assert.deepEqual(filterStories([story('Le siège')], 'thalmor'), [])
  })

  it('renvoie une liste vide pour une liste vide', () => {
    assert.deepEqual(filterStories([], ''), [])
  })

  it('ne modifie pas le tableau reçu', () => {
    const stories = [story('Épilogue'), story('Aube rouge')]

    filterStories(stories, '')

    assert.deepEqual(
      stories.map((s) => s.title),
      ['Épilogue', 'Aube rouge'],
    )
  })
})
