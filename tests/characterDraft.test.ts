import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { draftFrom, restoredDraft } from '../src/lib/characterDraft.ts'
import type { Character } from '../shared/schemas.ts'

const LYDIA: Character = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lydia',
  race: 'Nordique',
  relation: 'ami',
  role: 'Housecarl',
  note: 'Jure fidélité',
  groups: [],
  homePosition: { x: 10, y: 20 },
  knownPosition: { x: 30, y: 40 },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

function image(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
}

describe('draftFrom', () => {
  test('sans personnage, produit un brouillon vide sans image', () => {
    const draft = draftFrom(null)

    assert.equal(draft.name, '')
    assert.equal(draft.gameId, '')
    assert.equal(draft.race, 'Inconnue')
    assert.equal(draft.relation, 'inconnu')
    assert.deepEqual(draft.groups, [])
    assert.equal(draft.homePosition, undefined)
    assert.equal(draft.avatarBlob, null)
  })

  test('reprend les champs du personnage', () => {
    const draft = draftFrom(LYDIA)

    assert.equal(draft.name, 'Lydia')
    assert.equal(draft.role, 'Housecarl')
    assert.deepEqual(draft.homePosition, { x: 10, y: 20 })
  })

  // L'avatar déjà enregistré est un chemin de fichier, pas un blob : il reste
  // affiché via le personnage, il n'a rien à faire dans le brouillon.
  test('ne fabrique pas d’image depuis un avatar déjà enregistré', () => {
    assert.equal(draftFrom({ ...LYDIA, avatar: 'avatars/x.webp' }).avatarBlob, null)
  })

  test('ne partage pas le tableau de groupes du personnage', () => {
    const character: Character = { ...LYDIA, groups: ['g1'] }
    const draft = draftFrom(character)

    draft.groups.push('g2')

    assert.deepEqual(character.groups, ['g1'])
  })
})

describe('restoredDraft', () => {
  test('sans retour de placement, repart du personnage', () => {
    assert.deepEqual(restoredDraft(null, LYDIA), draftFrom(LYDIA))
  })

  test('applique la position générale posée sur la carte', () => {
    const draft = { ...draftFrom(null), name: 'Bjorn' }

    const restored = restoredDraft(
      { draft, update: { kind: 'home', position: { x: 5, y: 6 } } },
      null,
    )

    assert.deepEqual(restored.homePosition, { x: 5, y: 6 })
    assert.equal(restored.name, 'Bjorn', 'la saisie en cours doit survivre')
  })

  test('applique la position connue sans toucher à la générale', () => {
    const draft = { ...draftFrom(null), homePosition: { x: 1, y: 2 } }

    const restored = restoredDraft(
      { draft, update: { kind: 'known', position: { x: 7, y: 8, label: 'Blancherive' } } },
      null,
    )

    assert.deepEqual(restored.knownPosition, { x: 7, y: 8, label: 'Blancherive' })
    assert.deepEqual(restored.homePosition, { x: 1, y: 2 })
  })

  // Le cœur du bug #74 : la modale est démontée pendant le placement, l'image
  // choisie ne survivait pas au remontage.
  test('conserve l’image choisie quand une position est posée', () => {
    const blob = image()
    const draft = { ...draftFrom(null), name: 'Bjorn', avatarBlob: blob }

    const restored = restoredDraft(
      { draft, update: { kind: 'home', position: { x: 5, y: 6 } } },
      null,
    )

    assert.equal(restored.avatarBlob, blob)
  })

  test('conserve l’image choisie quand le placement est annulé', () => {
    const blob = image()
    const draft = { ...draftFrom(null), avatarBlob: blob }

    const restored = restoredDraft({ draft }, null)

    assert.equal(restored.avatarBlob, blob)
  })

  // En édition, l'ancien comportement réaffichait l'avatar enregistré : la
  // nouvelle image était perdue en silence.
  test('en édition, l’image choisie prime sur l’avatar déjà enregistré', () => {
    const blob = image()
    const character: Character = { ...LYDIA, avatar: 'avatars/ancien.webp' }
    const draft = { ...draftFrom(character), avatarBlob: blob }

    const restored = restoredDraft(
      { draft, update: { kind: 'known', position: { x: 9, y: 9 } } },
      character,
    )

    assert.equal(restored.avatarBlob, blob)
  })

  test('sans image choisie, le brouillon restauré n’en invente pas', () => {
    const restored = restoredDraft({ draft: draftFrom(null) }, null)

    assert.equal(restored.avatarBlob, null)
  })
})
