import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { groupInputFrom } from '../src/lib/groupInput.ts'
import type { Group } from '../shared/schemas.ts'

const COMPAGNONS: Group = {
  id: 'g1',
  name: 'Compagnons',
  color: '#c0663a',
  description: 'Guilde de Jorrvaskr',
  notes: 'Serment prêté à Jorrvaskr.',
}

// L'update d'un groupe est un remplacement complet côté serveur : un champ
// omis est effacé. Ces tests verrouillent le risque relevé dans #63 — renommer
// un groupe ne doit pas perdre sa description.
describe('groupInputFrom', () => {
  it('conserve couleur et description quand on renomme', () => {
    assert.deepEqual(groupInputFrom(COMPAGNONS, { name: 'Les Compagnons' }), {
      name: 'Les Compagnons',
      color: '#c0663a',
      description: 'Guilde de Jorrvaskr',
      notes: 'Serment prêté à Jorrvaskr.',
    })
  })

  it('conserve nom et description quand on recolore', () => {
    assert.deepEqual(groupInputFrom(COMPAGNONS, { color: '#4a7fb5' }), {
      name: 'Compagnons',
      color: '#4a7fb5',
      description: 'Guilde de Jorrvaskr',
      notes: 'Serment prêté à Jorrvaskr.',
    })
  })

  it('conserve nom et couleur quand on change la description', () => {
    assert.deepEqual(groupInputFrom(COMPAGNONS, { description: 'Mercenaires' }), {
      name: 'Compagnons',
      color: '#c0663a',
      description: 'Mercenaires',
      notes: 'Serment prêté à Jorrvaskr.',
    })
  })

  it('sans changement, reproduit le groupe à l’identique', () => {
    assert.deepEqual(groupInputFrom(COMPAGNONS, {}), {
      name: 'Compagnons',
      color: '#c0663a',
      description: 'Guilde de Jorrvaskr',
      notes: 'Serment prêté à Jorrvaskr.',
    })
  })

  it('n’invente pas de champs pour un groupe sans couleur ni description', () => {
    const minimal: Group = { id: 'g2', name: 'Thalmor', notes: '' }

    assert.deepEqual(groupInputFrom(minimal, { name: 'Thalmor' }), {
      name: 'Thalmor',
      color: undefined,
      description: undefined,
      notes: '',
    })
  })

  it('une description vidée est effacée, pas enregistrée comme chaîne vide', () => {
    assert.equal(groupInputFrom(COMPAGNONS, { description: '' }).description, undefined)
    assert.equal(groupInputFrom(COMPAGNONS, { description: '   ' }).description, undefined)
  })

  it('rogne les espaces autour de la description', () => {
    assert.equal(
      groupInputFrom(COMPAGNONS, { description: '  Guilde de Jorrvaskr  ' }).description,
      'Guilde de Jorrvaskr',
    )
  })

  // #113 : sans notes dans le retour, un renommage inline depuis GroupsList
  // enverrait un PUT sans notes et les effacerait en silence.
  it('conserve les notes quand on renomme, recolore ou change la description', () => {
    assert.equal(groupInputFrom(COMPAGNONS, { name: 'X' }).notes, COMPAGNONS.notes)
    assert.equal(groupInputFrom(COMPAGNONS, { color: '#4a7fb5' }).notes, COMPAGNONS.notes)
    assert.equal(groupInputFrom(COMPAGNONS, { description: 'Mercenaires' }).notes, COMPAGNONS.notes)
  })

  it('applique un changement de notes', () => {
    assert.equal(groupInputFrom(COMPAGNONS, { notes: 'Autres' }).notes, 'Autres')
  })

  it('ne modifie pas le groupe reçu', () => {
    groupInputFrom(COMPAGNONS, { name: 'Autre', description: 'Autre' })

    assert.equal(COMPAGNONS.name, 'Compagnons')
    assert.equal(COMPAGNONS.description, 'Guilde de Jorrvaskr')
  })
})
