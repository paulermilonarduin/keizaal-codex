import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { appearedGroupId, toggledIds } from '../src/lib/groupPicker.ts'
import type { Group } from '../shared/schemas.ts'

const GROUP_1: Group = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Compagnons',
  color: '#c0663a',
  notes: '',
}

const GROUP_2: Group = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Confrérie noire',
  notes: '',
}

describe('groupPicker - toggledIds (#114)', () => {
  test("ajoute l'id quand il est absent", () => {
    assert.deepEqual(toggledIds(['a'], 'b'), ['a', 'b'])
  })

  test("retire l'id quand il est présent", () => {
    assert.deepEqual(toggledIds(['a', 'b'], 'a'), ['b'])
  })

  test("sur une sélection vide, ajoute l'id", () => {
    assert.deepEqual(toggledIds([], 'a'), ['a'])
  })

  // La sélection appartient au brouillon de la fiche personnage : le picker la
  // reçoit en prop et ne doit jamais la muter, il émet un nouveau tableau.
  test("ne mute pas le tableau d'entrée", () => {
    const added = ['a']
    toggledIds(added, 'b')
    assert.deepEqual(added, ['a'])

    const removed = ['a', 'b']
    toggledIds(removed, 'a')
    assert.deepEqual(removed, ['a', 'b'])
  })
})

describe('groupPicker - appearedGroupId (#114)', () => {
  test("retourne l'id du groupe apparu", () => {
    assert.equal(appearedGroupId([GROUP_1.id], [GROUP_1, GROUP_2]), GROUP_2.id)
  })

  test("retourne null quand rien n'est apparu", () => {
    assert.equal(appearedGroupId([GROUP_1.id, GROUP_2.id], [GROUP_1, GROUP_2]), null)
  })

  test('retourne null quand la liste a seulement rétréci', () => {
    assert.equal(appearedGroupId([GROUP_1.id, GROUP_2.id], [GROUP_1]), null)
  })

  // Contrat assumé : cas irréaliste en mono-utilisateur (une création à la fois),
  // on prend le premier plutôt que d'inventer une heuristique.
  test('retourne le premier apparu si plusieurs', () => {
    assert.equal(appearedGroupId([], [GROUP_1, GROUP_2]), GROUP_1.id)
  })

  test('sur une liste vide de connus et de groupes, retourne null', () => {
    assert.equal(appearedGroupId([], []), null)
  })
})
