import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterGroups } from '../src/lib/filterGroups.ts'
import type { Group } from '../shared/schemas.ts'

function group(name: string, extra: Partial<Group> = {}): Group {
  return { id: name.toLowerCase(), name, ...extra }
}

describe('filterGroups', () => {
  it('trie par nom en français, indépendamment de l’ordre d’entrée', () => {
    const result = filterGroups([group('Éclaireurs'), group('Compagnons'), group('Aube'), group('Zénith')], '')

    assert.deepEqual(
      result.map((g) => g.name),
      ['Aube', 'Compagnons', 'Éclaireurs', 'Zénith'],
    )
  })

  it('filtre par nom sans tenir compte de la casse ni des accents', () => {
    const result = filterGroups([group('Éclaireurs'), group('Compagnons')], 'eclair')

    assert.deepEqual(
      result.map((g) => g.name),
      ['Éclaireurs'],
    )
  })

  it('cherche aussi dans la description', () => {
    const groups = [
      group('Compagnons', { description: 'Guilde de Jorrvaskr' }),
      group('Confrérie', { description: 'Assassins' }),
    ]

    const result = filterGroups(groups, 'jorrvaskr')

    assert.deepEqual(
      result.map((g) => g.name),
      ['Compagnons'],
    )
  })

  it('ignore les espaces autour du terme recherché', () => {
    const result = filterGroups([group('Compagnons'), group('Confrérie')], '  compa  ')

    assert.deepEqual(
      result.map((g) => g.name),
      ['Compagnons'],
    )
  })

  it('renvoie tout quand la recherche est vide', () => {
    const groups = [group('Compagnons'), group('Confrérie')]

    assert.equal(filterGroups(groups, '   ').length, 2)
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    assert.deepEqual(filterGroups([group('Compagnons')], 'thalmor'), [])
  })

  it('ne modifie pas le tableau reçu', () => {
    const groups = [group('Zénith'), group('Aube')]

    filterGroups(groups, '')

    assert.deepEqual(
      groups.map((g) => g.name),
      ['Zénith', 'Aube'],
    )
  })
})
