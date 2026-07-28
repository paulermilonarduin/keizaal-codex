import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkForUpdates,
  isNewer,
  parseVersion,
  selectNewerReleases,
} from '../src/lib/updateCheck.ts'

// Fabrique une release GitHub minimale : seuls les quatre champs que le module
// lit sont renseignés, l'API en renvoie beaucoup d'autres.
function release(
  tagName: string,
  options: { body?: string | null; prerelease?: boolean } = {},
): { tag_name: string; body?: string | null; html_url: string; prerelease: boolean } {
  return {
    tag_name: tagName,
    // `in` et non `??` : un body explicitement null doit rester null.
    body: 'body' in options ? options.body : 'notes',
    html_url: `https://github.com/paulermilonarduin/keizaal-codex/releases/tag/${tagName}`,
    prerelease: options.prerelease ?? false,
  }
}

// Mock de fetch : mémorise les URLs appelées et délègue la réponse à handler.
function fetchStub(
  calls: string[],
  handler: (url: string) => Response | Promise<Response>,
): typeof fetch {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    return handler(url)
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('parseVersion', () => {
  test('accepte vX.Y.Z avec ou sans préfixe v', () => {
    assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 })
    assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 })
  })

  test('rejette les formes incomplètes ou suffixées', () => {
    assert.equal(parseVersion('v1.2'), null)
    assert.equal(parseVersion('v1.2.3.4'), null)
    assert.equal(parseVersion('v1.2.3-beta'), null)
    assert.equal(parseVersion('abc'), null)
  })
})

describe('isNewer', () => {
  test('détecte une version plus récente sur chaque composant', () => {
    assert.equal(isNewer('v0.1.2', '0.1.1'), true)
    assert.equal(isNewer('v0.2.0', '0.1.1'), true)
    assert.equal(isNewer('v1.0.0', '0.1.1'), true)
  })

  test('égale ou plus ancienne → false', () => {
    assert.equal(isNewer('v0.1.1', '0.1.1'), false)
    assert.equal(isNewer('v0.1.0', '0.1.1'), false)
    assert.equal(isNewer('v0.0.9', '1.0.0'), false)
  })

  test('compare numériquement, pas lexicalement', () => {
    assert.equal(isNewer('v0.10.0', '0.9.0'), true)
    assert.equal(isNewer('v0.9.0', '0.10.0'), false)
  })

  test('tag non parseable → false', () => {
    assert.equal(isNewer('nightly', '0.1.1'), false)
    assert.equal(isNewer('v0.2.0', 'inconnue'), false)
  })
})

describe('selectNewerReleases', () => {
  test('ne garde que les versions plus récentes que la courante, triées décroissantes', () => {
    const selected = selectNewerReleases(
      [release('v0.1.1'), release('v0.2.0'), release('v0.1.2'), release('v0.1.0')],
      '0.1.1',
    )
    assert.deepEqual(
      selected.map((entry) => entry.version),
      ['0.2.0', '0.1.2'],
    )
  })

  test('exclut les prereleases', () => {
    const selected = selectNewerReleases(
      [release('v0.3.0', { prerelease: true }), release('v0.2.0')],
      '0.1.1',
    )
    assert.deepEqual(
      selected.map((entry) => entry.version),
      ['0.2.0'],
    )
  })

  test('ignore les tags non parseables sans jeter', () => {
    const selected = selectNewerReleases([release('nightly'), release('v0.2.0')], '0.1.1')
    assert.deepEqual(
      selected.map((entry) => entry.version),
      ['0.2.0'],
    )
  })

  test('body null devient chaîne vide', () => {
    const selected = selectNewerReleases([release('v0.2.0', { body: null })], '0.1.1')
    assert.equal(selected[0]?.body, '')
  })

  test('à jour → tableau vide', () => {
    assert.deepEqual(selectNewerReleases([release('v0.1.1'), release('v0.1.0')], '0.1.1'), [])
  })

  test('remonte l’URL de la page de release', () => {
    const selected = selectNewerReleases([release('v0.2.0')], '0.1.1')
    assert.equal(
      selected[0]?.url,
      'https://github.com/paulermilonarduin/keizaal-codex/releases/tag/v0.2.0',
    )
  })
})

describe('checkForUpdates', () => {
  test('appelle l’endpoint releases du repo', async () => {
    const calls: string[] = []
    await checkForUpdates('0.1.1', fetchStub(calls, () => jsonResponse([])))
    assert.equal(calls.length, 1)
    assert.ok(
      calls[0]?.includes('paulermilonarduin/keizaal-codex/releases'),
      `URL inattendue : ${calls[0]}`,
    )
  })

  test('payload valide → releases plus récentes filtrées et triées', async () => {
    const payload = [
      release('v0.1.2', { body: 'correctif' }),
      release('v0.3.0', { prerelease: true }),
      release('v0.2.0', { body: 'nouveautés' }),
      release('v0.1.1'),
    ]
    const result = await checkForUpdates('0.1.1', fetchStub([], () => jsonResponse(payload)))
    assert.deepEqual(result?.map((entry) => entry.version), ['0.2.0', '0.1.2'])
    assert.equal(result?.[0]?.body, 'nouveautés')
  })

  test('réponse non-ok (403 rate limit) → null', async () => {
    const result = await checkForUpdates(
      '0.1.1',
      fetchStub([], () => jsonResponse({ message: 'rate limit exceeded' }, 403)),
    )
    assert.equal(result, null)
  })

  test('fetch qui rejette (hors ligne) → null', async () => {
    const result = await checkForUpdates('0.1.1', () => Promise.reject(new Error('offline')))
    assert.equal(result, null)
  })

  test('corps illisible (JSON invalide) → null', async () => {
    const result = await checkForUpdates(
      '0.1.1',
      fetchStub([], () => new Response('<html>oups</html>', { status: 200 })),
    )
    assert.equal(result, null)
  })

  test('payload non conforme au schéma → null', async () => {
    const result = await checkForUpdates(
      '0.1.1',
      fetchStub([], () => jsonResponse([{ tag_name: 42 }])),
    )
    assert.equal(result, null)
  })

  test('à jour → tableau vide (pas null)', async () => {
    const result = await checkForUpdates(
      '0.1.1',
      fetchStub([], () => jsonResponse([release('v0.1.1'), release('v0.1.0')])),
    )
    assert.deepEqual(result, [])
  })
})
