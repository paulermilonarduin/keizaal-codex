import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { renderReleaseNotes } from '../src/lib/releaseNotes.ts'

describe('renderReleaseNotes', () => {
  test('rend les titres markdown', () => {
    const html = renderReleaseNotes('## Nouveautés')
    assert.match(html, /<h2>/)
    assert.match(html, /Nouveautés/)
  })

  test('rend les listes à puces', () => {
    const html = renderReleaseNotes('- premier point\n- second point')
    assert.match(html, /<ul>/)
    assert.equal(html.match(/<li>/g)?.length, 2)
  })

  test('rend un paragraphe simple', () => {
    assert.match(renderReleaseNotes('Une phrase.'), /<p>Une phrase\.<\/p>/)
  })

  test('échappe le HTML brut', () => {
    const html = renderReleaseNotes('<script>alert(1)</script>')
    assert.doesNotMatch(html, /<script/)
    assert.match(html, /&lt;script&gt;/)
  })

  test('les liens markdown s’ouvrent dans un nouvel onglet', () => {
    const html = renderReleaseNotes('[site](https://example.com)')
    assert.match(html, /<a[^>]*href="https:\/\/example\.com"/)
    assert.match(html, /<a[^>]*target="_blank"/)
    assert.match(html, /<a[^>]*rel="[^"]*noopener/)
  })

  test('linkifie les URLs nues avec le même target', () => {
    const html = renderReleaseNotes('https://example.com')
    assert.match(html, /<a[^>]*target="_blank"/)
  })
})
