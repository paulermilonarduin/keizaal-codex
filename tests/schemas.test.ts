import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { RACES, RELATIONS, POI_TYPES } from '../shared/enums.ts'
import {
  characterInputSchema,
  characterSchema,
  groupInputSchema,
  groupSchema,
  poiInputSchema,
  poiSchema,
} from '../shared/schemas.ts'

const UUID = '3f2b8c1a-9d4e-4c7b-a1f0-6e5d2c8b9a41'
const GROUP_UUID = '7c0a2e5f-1b3d-4a86-9c2e-d4f7b0a318c6'

describe('enums', () => {
  test('RACES contient les 10 races jouables + Inconnue', () => {
    assert.equal(RACES.length, 11)
    assert.ok(RACES.includes('Inconnue'))
    assert.ok(RACES.includes('Nordique'))
    assert.ok(RACES.includes('Argonien'))
  })

  test('RELATIONS contient les 4 relations, inconnu inclus', () => {
    assert.deepEqual([...RELATIONS].sort(), ['ami', 'ennemi', 'inconnu', 'neutre'])
  })

  test('POI_TYPES contient les 20 types prévus (un par icône)', () => {
    assert.deepEqual(
      [...POI_TYPES].sort(),
      [
        'camp',
        'capitale',
        'cave',
        'docks',
        'dragon-lair',
        'dwemer',
        'farm',
        'fort',
        'giant-camp',
        'keep',
        'landmark',
        'lighthouse',
        'mine',
        'nordic-ruin',
        'orc-stronghold',
        'shack',
        'shrine',
        'standing-stones',
        'village',
        'ville',
      ].sort(),
    )
  })
})

describe('characterInputSchema — identité minimale (name OU gameId)', () => {
  test('accepte un nom seul', () => {
    const result = characterInputSchema.safeParse({ name: 'Compte-les-Sous' })
    assert.ok(result.success)
  })

  test('accepte un gameId seul', () => {
    const result = characterInputSchema.safeParse({ gameId: '#48213' })
    assert.ok(result.success)
  })

  test('refuse sans nom ni gameId', () => {
    const result = characterInputSchema.safeParse({ race: 'Nordique' })
    assert.equal(result.success, false)
  })

  test('refuse un nom vide ou blanc comme seule identité', () => {
    assert.equal(characterInputSchema.safeParse({ name: '' }).success, false)
    assert.equal(characterInputSchema.safeParse({ name: '   ' }).success, false)
  })
})

describe('characterInputSchema — valeurs par défaut et nettoyage', () => {
  test('applique les défauts : race Inconnue, relation inconnu, groups vide', () => {
    const result = characterInputSchema.parse({ name: 'Lydia' })
    assert.equal(result.race, 'Inconnue')
    assert.equal(result.relation, 'inconnu')
    assert.deepEqual(result.groups, [])
  })

  test('trim le nom et le gameId', () => {
    const result = characterInputSchema.parse({ name: '  Lydia  ', gameId: ' #48213 ' })
    assert.equal(result.name, 'Lydia')
    assert.equal(result.gameId, '#48213')
  })

  test('supprime les clés inconnues', () => {
    const result = characterInputSchema.parse({ name: 'Lydia', hacky: true })
    assert.ok(!('hacky' in result))
  })
})

describe('characterInputSchema — champs contraints', () => {
  test('refuse une race hors liste fermée', () => {
    const result = characterInputSchema.safeParse({ name: 'Lydia', race: 'Dremora' })
    assert.equal(result.success, false)
  })

  test('refuse une relation hors liste', () => {
    const result = characterInputSchema.safeParse({ name: 'Lydia', relation: 'rival' })
    assert.equal(result.success, false)
  })

  test('refuse un groupe qui n’est pas un UUID', () => {
    const result = characterInputSchema.safeParse({ name: 'Lydia', groups: ['compagnons'] })
    assert.equal(result.success, false)
  })

  test('accepte un personnage complet avec positions', () => {
    const result = characterInputSchema.safeParse({
      gameId: '#48213',
      name: 'Compte-les-Sous',
      race: 'Argonien',
      relation: 'ami',
      role: 'Aubergiste',
      groups: [GROUP_UUID],
      note: 'Tient l’auberge de Blancherive.',
      homePosition: { x: 2450, y: 3120, label: 'Blancherive' },
      knownPosition: { x: 1100, y: 900, label: 'Solitude', date: '2026-07-15' },
    })
    assert.ok(result.success)
  })

  test('accepte une knownPosition sans date (elle est optionnelle)', () => {
    const result = characterInputSchema.safeParse({
      name: 'Lydia',
      knownPosition: { x: 10, y: 20 },
    })
    assert.ok(result.success)
  })

  test('refuse une date de knownPosition mal formée', () => {
    const result = characterInputSchema.safeParse({
      name: 'Lydia',
      knownPosition: { x: 10, y: 20, date: '15/07/2026' },
    })
    assert.equal(result.success, false)
  })

  test('refuse des coordonnées non numériques', () => {
    const result = characterInputSchema.safeParse({
      name: 'Lydia',
      homePosition: { x: '2450', y: 3120 },
    })
    assert.equal(result.success, false)
  })

  test('la homePosition ne porte jamais de date', () => {
    const result = characterInputSchema.parse({
      name: 'Lydia',
      homePosition: { x: 10, y: 20, date: '2026-07-15' },
    })
    assert.ok(!('date' in (result.homePosition ?? {})))
  })
})

describe('characterSchema — DTO complet (serveur)', () => {
  const fullCharacter = {
    id: UUID,
    gameId: '#48213',
    name: 'Compte-les-Sous',
    race: 'Argonien',
    relation: 'ami',
    role: 'Aubergiste',
    groups: [GROUP_UUID],
    note: 'Bavard, aime les septims.',
    avatar: `avatars/${UUID}.webp`,
    homePosition: { x: 2450, y: 3120, label: 'Blancherive' },
    knownPosition: { x: 1100, y: 900, label: 'Solitude', date: '2026-07-15' },
    createdAt: '2026-07-01T18:00:00Z',
    updatedAt: '2026-07-17T20:30:00Z',
  }

  test('accepte l’exemple complet du cahier des charges', () => {
    assert.ok(characterSchema.safeParse(fullCharacter).success)
  })

  test('refuse un id qui n’est pas un UUID', () => {
    const result = characterSchema.safeParse({ ...fullCharacter, id: 'abc' })
    assert.equal(result.success, false)
  })

  test('refuse un createdAt qui n’est pas un datetime ISO', () => {
    const result = characterSchema.safeParse({ ...fullCharacter, createdAt: 'hier' })
    assert.equal(result.success, false)
  })

  test('exige aussi l’identité minimale', () => {
    const anonymous = { ...fullCharacter, gameId: undefined, name: undefined }
    assert.equal(characterSchema.safeParse(anonymous).success, false)
  })
})

describe('groupInputSchema / groupSchema', () => {
  test('accepte un groupe minimal (nom seul)', () => {
    assert.ok(groupInputSchema.safeParse({ name: 'Compagnons' }).success)
  })

  test('refuse un nom manquant ou vide', () => {
    assert.equal(groupInputSchema.safeParse({}).success, false)
    assert.equal(groupInputSchema.safeParse({ name: '  ' }).success, false)
  })

  test('accepte une couleur hex à 6 chiffres, refuse le reste', () => {
    assert.ok(groupInputSchema.safeParse({ name: 'Compagnons', color: '#c0392b' }).success)
    assert.equal(groupInputSchema.safeParse({ name: 'Compagnons', color: 'rouge' }).success, false)
    assert.equal(groupInputSchema.safeParse({ name: 'Compagnons', color: '#c39' }).success, false)
  })

  test('groupSchema exige un id UUID', () => {
    assert.ok(groupSchema.safeParse({ id: GROUP_UUID, name: 'Compagnons' }).success)
    assert.equal(groupSchema.safeParse({ id: '42', name: 'Compagnons' }).success, false)
  })
})

describe('poiInputSchema / poiSchema', () => {
  test('accepte un POI minimal et applique le type par défaut « landmark »', () => {
    const result = poiInputSchema.parse({ name: 'Blancherive', x: 2450, y: 3100 })
    assert.equal(result.type, 'landmark')
  })

  test('accepte les types de la liste fermée', () => {
    const result = poiInputSchema.safeParse({ name: 'Blancherive', type: 'capitale', x: 1, y: 2 })
    assert.ok(result.success)
  })

  test('refuse un type hors liste', () => {
    const result = poiInputSchema.safeParse({ name: 'Blancherive', type: 'donjon', x: 1, y: 2 })
    assert.equal(result.success, false)
  })

  test('refuse un POI sans coordonnées', () => {
    assert.equal(poiInputSchema.safeParse({ name: 'Blancherive' }).success, false)
  })

  test('poiSchema exige un id UUID', () => {
    assert.ok(poiSchema.safeParse({ id: UUID, name: 'Rivebois', type: 'village', x: 1, y: 2 }).success)
    assert.equal(poiSchema.safeParse({ id: 7, name: 'Rivebois', type: 'village', x: 1, y: 2 }).success, false)
  })
})
