import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, match, formatShortDate } from '../src/lib/text.ts'
import { filterCharacters } from '../src/lib/filterCharacters.ts'
import { findDuplicateSuggestions } from '../src/lib/duplicateSuggestions.ts'
import { isPoiVisibleAtZoom } from '../src/lib/poiVisibility.ts'
import type { Character } from '../shared/schemas.ts'

describe('normalize', () => {
  test('met en minuscules et retire les accents', () => {
    assert.equal(normalize('Élan-du-Nord'), 'elan-du-nord')
    assert.equal(normalize('BRÉTONNE'), 'bretonne')
  })
})

describe('formatShortDate', () => {
  test('convertit YYYY-MM-DD en JJ/MM', () => {
    assert.equal(formatShortDate('2026-07-17'), '17/07')
  })
})

describe('match', () => {
  test('trouve une sous-chaîne indépendamment de la casse et des accents', () => {
    assert.equal(match('Bjorn Trois-Cognées', 'cognees'), true)
    assert.equal(match('Bjorn Trois-Cognées', 'COGNÉES'), true)
  })

  test('renvoie false si la sous-chaîne est absente', () => {
    assert.equal(match('Bjorn Trois-Cognées', 'khajiit'), false)
  })
})

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: undefined,
    gameId: undefined,
    race: 'Inconnue',
    relation: 'inconnu',
    role: undefined,
    note: undefined,
    groups: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('filterCharacters', () => {
  const groupId = '7c0a2e5f-1b3d-4a86-9c2e-d4f7b0a318c6'
  const lydia = makeCharacter({ name: 'Lydia', race: 'Nordique', relation: 'ami', role: 'Huscarl' })
  const saanya = makeCharacter({
    name: 'Saanya Croc-de-Lune',
    race: 'Khajiit',
    relation: 'ami',
    groups: [groupId],
  })
  const anon = makeCharacter({ gameId: '#58213', race: 'Inconnue', relation: 'inconnu' })
  const all = [lydia, saanya, anon]
  const noCriteria = { search: '', race: null, relation: null, groupId: null }

  test('sans critère, renvoie tout, trié alphabétiquement par nom (ou gameId)', () => {
    const result = filterCharacters(all, noCriteria)
    assert.deepEqual(
      result.map((c) => c.name ?? c.gameId),
      ['#58213', 'Lydia', 'Saanya Croc-de-Lune'],
    )
  })

  test('recherche sur le nom, insensible à la casse et aux accents', () => {
    const result = filterCharacters(all, { ...noCriteria, search: 'CROC' })
    assert.deepEqual(result, [saanya])
  })

  test('recherche sur le gameId', () => {
    const result = filterCharacters(all, { ...noCriteria, search: '58213' })
    assert.deepEqual(result, [anon])
  })

  test('recherche sur le rôle', () => {
    const result = filterCharacters(all, { ...noCriteria, search: 'huscarl' })
    assert.deepEqual(result, [lydia])
  })

  test('filtre par race', () => {
    const result = filterCharacters(all, { ...noCriteria, race: 'Khajiit' })
    assert.deepEqual(result, [saanya])
  })

  test('filtre par relation', () => {
    const result = filterCharacters(all, { ...noCriteria, relation: 'inconnu' })
    assert.deepEqual(result, [anon])
  })

  test('filtre par groupe', () => {
    const result = filterCharacters(all, { ...noCriteria, groupId })
    assert.deepEqual(result, [saanya])
  })

  test('les filtres se combinent (recherche + race)', () => {
    const result = filterCharacters(all, { ...noCriteria, search: 'a', race: 'Nordique' })
    assert.deepEqual(result, [lydia])
  })

  test('aucune correspondance → tableau vide', () => {
    const result = filterCharacters(all, { ...noCriteria, search: 'orque introuvable' })
    assert.deepEqual(result, [])
  })
})

describe('findDuplicateSuggestions', () => {
  const lydia = makeCharacter({ name: 'Lydia', gameId: '#11111' })
  const saanya = makeCharacter({ name: 'Saanya Croc-de-Lune', gameId: '#93027' })
  const anon = makeCharacter({ gameId: '#58213' })
  const all = [lydia, saanya, anon]

  test('propose les fiches dont le nom correspond', () => {
    assert.deepEqual(findDuplicateSuggestions(all, { name: 'croc' }), [saanya])
  })

  test('propose les fiches dont le gameId correspond, avec ou sans le #', () => {
    assert.deepEqual(findDuplicateSuggestions(all, { gameId: '58213' }), [anon])
    assert.deepEqual(findDuplicateSuggestions(all, { gameId: '#58213' }), [anon])
  })

  test('combine nom et gameId (correspondance sur l’un ou l’autre)', () => {
    const result = findDuplicateSuggestions(all, { name: 'lydia', gameId: '93027' })
    assert.deepEqual(
      result.map((c) => c.id).sort(),
      [lydia, saanya].map((c) => c.id).sort(),
    )
  })

  test('ignore les saisies trop courtes (< 2 caractères)', () => {
    assert.deepEqual(findDuplicateSuggestions(all, { name: 'l' }), [])
  })

  test('sans aucune saisie → tableau vide', () => {
    assert.deepEqual(findDuplicateSuggestions(all, {}), [])
  })

  test('exclut la fiche en cours d’édition', () => {
    assert.deepEqual(findDuplicateSuggestions(all, { name: 'lydia' }, lydia.id), [])
  })
})

describe('isPoiVisibleAtZoom', () => {
  test('capitale et ville sont toujours visibles, même très dézoomé', () => {
    assert.equal(isPoiVisibleAtZoom('capitale', -3, -3), true)
    assert.equal(isPoiVisibleAtZoom('ville', -3, -3), true)
  })

  test('les autres types sont masqués trop loin du zoom minimal', () => {
    assert.equal(isPoiVisibleAtZoom('village', -3, -3), false)
    assert.equal(isPoiVisibleAtZoom('fort', -3, -3), false)
    assert.equal(isPoiVisibleAtZoom('landmark', -3, -3), false)
  })

  test('les autres types réapparaissent une fois assez zoomé', () => {
    assert.equal(isPoiVisibleAtZoom('village', -2, -3), true)
    assert.equal(isPoiVisibleAtZoom('fort', 0, -3), true)
  })

  test('le seuil est relatif au zoom minimal de la carte, pas absolu', () => {
    assert.equal(isPoiVisibleAtZoom('village', 0, 0), false)
    assert.equal(isPoiVisibleAtZoom('village', 1, 0), true)
  })
})
