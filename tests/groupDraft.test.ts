import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInput, draftFrom } from '../src/lib/groupDraft.ts'
import type { Group } from '../shared/schemas.ts'

const COMPAGNONS: Group = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Compagnons',
  color: '#c0663a',
  description: 'Guilde de Jorrvaskr',
  notes: 'Serment prêté à Jorrvaskr.',
}

describe('draftFrom', () => {
  test('sans groupe, produit un brouillon vierge à la couleur par défaut', () => {
    assert.deepEqual(draftFrom(null), {
      name: '',
      color: '#d9b54a',
      description: '',
      notes: '',
    })
  })

  test('reprend tous les champs du groupe', () => {
    assert.deepEqual(draftFrom(COMPAGNONS), {
      name: 'Compagnons',
      color: '#c0663a',
      description: 'Guilde de Jorrvaskr',
      notes: 'Serment prêté à Jorrvaskr.',
    })
  })

  // Le champ est un <input type="color"> : il exige toujours une valeur, un
  // groupe sans couleur repart donc sur celle par défaut.
  test('remplace une couleur absente par la couleur par défaut', () => {
    assert.equal(draftFrom({ ...COMPAGNONS, color: undefined }).color, '#d9b54a')
  })

  test('une description absente devient une chaîne vide', () => {
    assert.equal(draftFrom({ ...COMPAGNONS, description: undefined }).description, '')
  })
})

describe('buildInput', () => {
  test('trime le nom', () => {
    assert.equal(buildInput({ ...draftFrom(null), name: '  Compagnons  ' }).name, 'Compagnons')
  })

  // Même règle que groupInputFrom : le schéma déclare la description
  // optionnelle, '' serait un état parasite.
  test('efface une description vide ou blanche', () => {
    assert.equal(buildInput({ ...draftFrom(COMPAGNONS), description: '' }).description, undefined)
    assert.equal(buildInput({ ...draftFrom(COMPAGNONS), description: '   ' }).description, undefined)
    assert.equal(
      buildInput({ ...draftFrom(COMPAGNONS), description: '  Mercenaires  ' }).description,
      'Mercenaires',
    )
  })

  test('reprend la couleur et les notes telles quelles', () => {
    const input = buildInput({ ...draftFrom(COMPAGNONS), notes: '  espaces gardés  ' })

    assert.equal(input.color, '#c0663a')
    assert.equal(input.notes, '  espaces gardés  ')
  })
})
