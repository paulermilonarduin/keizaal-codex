import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { movedCharacterInput } from '../src/lib/characterInput.ts'
import { characterInputSchema } from '../shared/schemas.ts'
import type { Character } from '../shared/schemas.ts'

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: crypto.randomUUID(),
    name: 'Lydia',
    gameId: undefined,
    race: 'Nordique',
    relation: 'ami',
    role: undefined,
    note: undefined,
    groups: [],
    position: { x: 10, y: 20 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// `characters.update` est un PUT : il remplace toute la fiche. Déplacer un pin
// doit donc reconstruire l'entrée complète, sans rien perdre au passage (#88).
describe('movedCharacterInput (#88)', () => {
  test('remplace la position par les nouvelles coordonnées', () => {
    const character = makeCharacter({ position: { x: 10, y: 20 } })

    const result = movedCharacterInput(character, { x: 300, y: 400 })

    assert.deepEqual(result.position, { x: 300, y: 400 })
  })

  test('conserve tous les champs de la fiche', () => {
    const character = makeCharacter({
      name: 'Bjorn',
      gameId: '#12345',
      race: 'Rougegarde',
      relation: 'ennemi',
      role: 'Forgeron',
      note: 'Croisé à Blancherive',
    })

    const result = movedCharacterInput(character, { x: 1, y: 2 })

    assert.equal(result.name, 'Bjorn')
    assert.equal(result.gameId, '#12345')
    assert.equal(result.race, 'Rougegarde')
    assert.equal(result.relation, 'ennemi')
    assert.equal(result.role, 'Forgeron')
    assert.equal(result.note, 'Croisé à Blancherive')
  })

  test('copie les groupes sans partager le tableau du store', () => {
    const groups = [crypto.randomUUID(), crypto.randomUUID()]
    const character = makeCharacter({ groups })

    const result = movedCharacterInput(character, { x: 1, y: 2 })

    assert.deepEqual(result.groups, groups)
    assert.notStrictEqual(result.groups, character.groups)

    result.groups?.push(crypto.randomUUID())
    assert.equal(character.groups.length, 2)
  })

  test('ne reporte ni id, ni avatar, ni timestamps', () => {
    const character = makeCharacter({ avatar: 'avatars/abc.webp' })

    const result = movedCharacterInput(character, { x: 1, y: 2 })

    assert.equal('id' in result, false)
    assert.equal('avatar' in result, false)
    assert.equal('createdAt' in result, false)
    assert.equal('updatedAt' in result, false)
  })

  test('produit une entrée valide pour characterInputSchema', () => {
    const result = movedCharacterInput(makeCharacter(), { x: 1, y: 2 })

    assert.equal(characterInputSchema.safeParse(result).success, true)
  })
})
