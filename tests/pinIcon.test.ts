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
    assert.match(
      buildPinIcon(makeCharacter({ name: 'Lydia' }), { active: false, editable: false }),
      /Lydia/,
    )
    assert.match(
      buildPinIcon(makeCharacter({ name: undefined, gameId: '#123' }), {
        active: false,
        editable: false,
      }),
      /#123/,
    )
  })

  test('affiche un « ? » sans avatar, une image avec avatar', () => {
    const withoutAvatar = buildPinIcon(makeCharacter(), { active: false, editable: false })
    assert.match(withoutAvatar, /pin__fallback">\?</)

    const withAvatar = buildPinIcon(makeCharacter({ avatar: 'avatars/abc.webp' }), {
      active: false,
      editable: false,
    })
    assert.match(withAvatar, /<img src="\/avatars\/abc\.webp"/)
  })

  // #108 : l'URL du fichier avatar est stable alors que son contenu change à
  // chaque remplacement. Sans cache-buster, le navigateur resservait l'ancienne
  // image dans le pin.
  test('le src de l’avatar contient le cache-buster ?v=', () => {
    const html = buildPinIcon(makeCharacter({ avatar: 'avatars/abc.webp' }), {
      active: false,
      editable: false,
    })
    assert.match(html, /\/avatars\/abc\.webp\?v=/)
  })

  test('applique la classe de relation', () => {
    assert.match(
      buildPinIcon(makeCharacter({ relation: 'ennemi' }), { active: false, editable: false }),
      /rel-ennemi/,
    )
    assert.match(
      buildPinIcon(makeCharacter({ relation: 'inconnu' }), { active: false, editable: false }),
      /rel-inconnu/,
    )
  })

  // #80 : une seule position par personnage, donc plus de distinction
  // générale/connue à coder. Le pin est en bordure pleine, `is-known` a disparu.
  test('n’émet plus de variante pointillée', () => {
    assert.doesNotMatch(
      buildPinIcon(makeCharacter(), { active: false, editable: false }),
      /is-known/,
    )
  })

  test('applique is-active quand le personnage est survolé ou sélectionné', () => {
    assert.doesNotMatch(
      buildPinIcon(makeCharacter(), { active: false, editable: false }),
      /is-active/,
    )
    assert.match(buildPinIcon(makeCharacter(), { active: true, editable: false }), /is-active/)
  })

  // Mode édition des personnages (#88) : la classe ne porte qu'un curseur
  // `grab`, la géométrie du pin reste inchangée (non-régression #81).
  test('applique is-editable en mode édition', () => {
    assert.doesNotMatch(
      buildPinIcon(makeCharacter(), { active: false, editable: false }),
      /is-editable/,
    )
    assert.match(buildPinIcon(makeCharacter(), { active: false, editable: true }), /is-editable/)
  })

  test('échappe le HTML du nom et du gameId', () => {
    const html = buildPinIcon(makeCharacter({ name: '<script>alert(1)</script>' }), {
      active: false,
      editable: false,
    })
    assert.doesNotMatch(html, /<script>/)
    assert.match(html, /&lt;script&gt;/)
  })
})
