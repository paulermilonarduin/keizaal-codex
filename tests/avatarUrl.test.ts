import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { avatarUrl } from '../src/lib/avatarUrl.ts'

describe('avatarUrl', () => {
  test('retourne null quand la fiche n’a pas d’avatar', () => {
    assert.equal(avatarUrl({ avatar: undefined, updatedAt: '2026-01-01T00:00:00.000Z' }), null)
  })

  test('construit /avatars/<id>.webp?v=<updatedAt encodé>', () => {
    assert.equal(
      avatarUrl({ avatar: 'avatars/abc.webp', updatedAt: '2026-01-01T00:00:00.000Z' }),
      '/avatars/abc.webp?v=2026-01-01T00%3A00%3A00.000Z',
    )
  })

  test('encode les caractères réservés de l’ISO', () => {
    const url = avatarUrl({ avatar: 'avatars/abc.webp', updatedAt: '2026-01-01T00:00:00.000Z' })
    assert.equal(typeof url, 'string')
    const query = String(url).slice(String(url).indexOf('?'))
    assert.doesNotMatch(query, /:/)
    assert.match(query, /%3A/)
  })
})
