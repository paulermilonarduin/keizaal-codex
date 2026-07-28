import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInput, draftFrom } from '../src/lib/storyDraft.ts'
import type { Story } from '../shared/schemas.ts'

const SIEGE: Story = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Le siège de Blancherive',
  date: '2026-07-17',
  notes: 'Une nuit de feu.',
  characters: ['c1'],
  groups: ['g1'],
  pois: ['p1'],
}

describe('draftFrom', () => {
  test('sans histoire, produit un brouillon vide', () => {
    const draft = draftFrom(null)

    assert.equal(draft.title, '')
    assert.equal(draft.date, '')
    assert.equal(draft.notes, '')
    assert.deepEqual(draft.characters, [])
    assert.deepEqual(draft.groups, [])
    assert.deepEqual(draft.pois, [])
  })

  test('reprend tous les champs de l’histoire', () => {
    const draft = draftFrom(SIEGE)

    assert.equal(draft.title, 'Le siège de Blancherive')
    assert.equal(draft.date, '2026-07-17')
    assert.equal(draft.notes, 'Une nuit de feu.')
    assert.deepEqual(draft.characters, ['c1'])
    assert.deepEqual(draft.groups, ['g1'])
    assert.deepEqual(draft.pois, ['p1'])
  })

  // Le champ est un <input type="date"> : il ne sait rien manipuler d'autre
  // qu'une chaîne, l'absence de date se représente donc par ''.
  test('une histoire sans date donne une chaîne vide', () => {
    assert.equal(draftFrom({ ...SIEGE, date: undefined }).date, '')
  })

  test('ne partage pas les tableaux de liens de l’histoire', () => {
    const draft = draftFrom(SIEGE)

    draft.characters.push('c2')
    draft.groups.push('g2')
    draft.pois.push('p2')

    assert.deepEqual(SIEGE.characters, ['c1'])
    assert.deepEqual(SIEGE.groups, ['g1'])
    assert.deepEqual(SIEGE.pois, ['p1'])
  })
})

describe('buildInput', () => {
  test('trime le titre', () => {
    const input = buildInput({ ...draftFrom(null), title: '  Le siège  ' })

    assert.equal(input.title, 'Le siège')
  })

  test('convertit une date vide en date absente', () => {
    const input = buildInput({ ...draftFrom(null), title: 'Le siège', date: '' })

    assert.equal(input.date, undefined)
  })

  test('conserve une date saisie', () => {
    const input = buildInput({ ...draftFrom(null), title: 'Le siège', date: '2026-07-17' })

    assert.equal(input.date, '2026-07-17')
  })

  test('conserve les notes et les trois tableaux de liens', () => {
    const input = buildInput(draftFrom(SIEGE))

    assert.equal(input.notes, 'Une nuit de feu.')
    assert.deepEqual(input.characters, ['c1'])
    assert.deepEqual(input.groups, ['g1'])
    assert.deepEqual(input.pois, ['p1'])
  })
})
