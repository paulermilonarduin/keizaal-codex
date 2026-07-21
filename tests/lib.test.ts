import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, match } from '../src/lib/text.ts'
import { filterCharacters } from '../src/lib/filterCharacters.ts'
import type { Character } from '../shared/schemas.ts'

describe('normalize', () => {
  test('met en minuscules et retire les accents', () => {
    assert.equal(normalize('Élan-du-Nord'), 'elan-du-nord')
    assert.equal(normalize('BRÉTONNE'), 'bretonne')
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
