import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPinIcon } from '../src/components/map/pinIcon.ts'
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildPinIcon', () => {
  test('affiche le nom, ou le gameId si pas de nom', () => {
    assert.match(buildPinIcon(makeCharacter({ name: 'Lydia' }), 'home', { active: false }), /Lydia/)
    assert.match(
      buildPinIcon(makeCharacter({ name: undefined, gameId: '#123' }), 'home', { active: false }),
      /#123/,
    )
  })

  test('affiche un « ? » sans avatar, une image avec avatar', () => {
    const withoutAvatar = buildPinIcon(makeCharacter(), 'home', { active: false })
    assert.match(withoutAvatar, /pin__fallback">\?</)

    const withAvatar = buildPinIcon(makeCharacter({ avatar: 'avatars/abc.webp' }), 'home', {
      active: false,
    })
    assert.match(withAvatar, /<img src="\/avatars\/abc\.webp"/)
  })

  test('applique la classe de relation', () => {
    assert.match(buildPinIcon(makeCharacter({ relation: 'ennemi' }), 'home', { active: false }), /rel-ennemi/)
    assert.match(
      buildPinIcon(makeCharacter({ relation: 'inconnu' }), 'home', { active: false }),
      /rel-inconnu/,
    )
  })

  test('bordure pointillée (is-known) uniquement pour la position connue', () => {
    assert.doesNotMatch(buildPinIcon(makeCharacter(), 'home', { active: false }), /is-known/)
    assert.match(buildPinIcon(makeCharacter(), 'known', { active: false }), /is-known/)
  })

  test('applique is-active quand le personnage est survolé ou sélectionné', () => {
    assert.doesNotMatch(buildPinIcon(makeCharacter(), 'home', { active: false }), /is-active/)
    assert.match(buildPinIcon(makeCharacter(), 'home', { active: true }), /is-active/)
  })

  test('échappe le HTML du nom et du gameId', () => {
    const html = buildPinIcon(makeCharacter({ name: '<script>alert(1)</script>' }), 'home', {
      active: false,
    })
    assert.doesNotMatch(html, /<script>/)
    assert.match(html, /&lt;script&gt;/)
  })
})
