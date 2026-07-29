import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createModalStack } from '../src/lib/modalStack.ts'

describe('modalStack', () => {
  test('isTop d’un token jamais poussé renvoie false', () => {
    const pile = createModalStack()

    assert.equal(pile.isTop({}), false)
  })

  // Modale seule : comportement inchangé, Échap la ferme.
  test('un seul token poussé est au sommet', () => {
    const pile = createModalStack()
    const a = {}

    pile.push(a)

    assert.equal(pile.isTop(a), true)
  })

  // Cas du bug (#107) : Échap ne doit fermer que la ConfirmDialog empilée.
  test('seul le dernier token poussé est au sommet', () => {
    const pile = createModalStack()
    const a = {}
    const b = {}

    pile.push(a)
    pile.push(b)

    assert.equal(pile.isTop(b), true)
    assert.equal(pile.isTop(a), false)
  })

  // Le second Échap ferme la modale en dessous.
  test('retirer le sommet rend le sommet au token précédent', () => {
    const pile = createModalStack()
    const a = {}
    const b = {}

    pile.push(a)
    pile.push(b)
    pile.remove(b)

    assert.equal(pile.isTop(a), true)
  })

  // Démontage désordonné : rien ne garantit que Vue démonte dans l'ordre inverse.
  test('retirer un token au milieu laisse le sommet inchangé', () => {
    const pile = createModalStack()
    const a = {}
    const b = {}
    const c = {}

    pile.push(a)
    pile.push(b)
    pile.push(c)
    pile.remove(b)

    assert.equal(pile.isTop(c), true)
    assert.equal(pile.isTop(a), false)
  })

  test('retirer un token absent est sans effet', () => {
    const pile = createModalStack()
    const a = {}
    const b = {}

    pile.push(a)
    pile.remove(b)

    assert.equal(pile.isTop(a), true)
  })

  test('après le retrait du dernier token plus rien n’est au sommet', () => {
    const pile = createModalStack()
    const a = {}

    pile.push(a)
    pile.remove(a)

    assert.equal(pile.isTop(a), false)
  })

  // Réouverture d'une modale : le même token peut revenir au sommet.
  test('un token retiré puis repoussé redevient au sommet', () => {
    const pile = createModalStack()
    const a = {}
    const b = {}

    pile.push(a)
    pile.push(b)
    pile.remove(a)
    pile.push(a)

    assert.equal(pile.isTop(a), true)
  })
})
