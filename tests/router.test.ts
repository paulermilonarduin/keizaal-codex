import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { characterInputSchema } from '../shared/schemas.ts'
import { createRouter, type Route } from '../server/lib/router.ts'
import { ConflictError, NotFoundError, ValidationError } from '../server/lib/errors.ts'
import { createApp } from '../server/server.ts'
import { openDb } from '../server/db.ts'

export async function withServer(
  handler: http.RequestListener,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const routes: Route[] = [
  { method: 'GET', path: '/api/ping', handler: () => ({ status: 200, body: { pong: true } }) },
  {
    method: 'GET',
    path: '/api/things/:id',
    handler: ({ params }) => ({ status: 200, body: { id: params.id } }),
  },
  { method: 'POST', path: '/api/things', handler: ({ body }) => ({ status: 201, body }) },
  {
    method: 'POST',
    path: '/api/characters',
    handler: ({ body }) => ({ status: 201, body: characterInputSchema.parse(body) }),
  },
  {
    method: 'GET',
    path: '/api/introuvable',
    handler: () => {
      throw new NotFoundError('fiche inconnue')
    },
  },
  {
    method: 'GET',
    path: '/api/conflit',
    handler: () => {
      throw new ConflictError('gameId déjà pris')
    },
  },
  {
    method: 'GET',
    path: '/api/invalide',
    handler: () => {
      throw new ValidationError('nom requis', 'name')
    },
  },
  {
    method: 'GET',
    path: '/api/boom',
    handler: () => {
      throw new Error('détail interne secret')
    },
  },
]

describe('router — routage', () => {
  test('répond en JSON sur une route simple', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/ping`)
      assert.equal(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /application\/json/)
      assert.deepEqual(await res.json(), { pong: true })
    })
  })

  test('extrait les paramètres nommés', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/things/42`)
      assert.deepEqual(await res.json(), { id: '42' })
    })
  })

  test('parse le body JSON et respecte le statut du handler', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/things`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia' }),
      })
      assert.equal(res.status, 201)
      assert.deepEqual(await res.json(), { name: 'Lydia' })
    })
  })

  test('route inconnue sous /api → 404', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/nexiste/pas`)
      assert.equal(res.status, 404)
      const body = (await res.json()) as { code: string }
      assert.equal(body.code, 'NOT_FOUND')
    })
  })

  test('même chemin mais mauvaise méthode → 404', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/ping`, { method: 'POST' })
      assert.equal(res.status, 404)
    })
  })

  test('body JSON malformé → 400', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/things`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'pas du json {',
      })
      assert.equal(res.status, 400)
      const body = (await res.json()) as { code: string }
      assert.equal(body.code, 'VALIDATION')
    })
  })
})

describe('router — traduction des erreurs', () => {
  test('ZodError → 400 avec le champ fautif', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/characters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lydia', race: 'Dremora' }),
      })
      assert.equal(res.status, 400)
      const body = (await res.json()) as { code: string; field?: string }
      assert.equal(body.code, 'VALIDATION')
      assert.equal(body.field, 'race')
    })
  })

  test('ValidationError → 400 avec le champ', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/invalide`)
      assert.equal(res.status, 400)
      const body = (await res.json()) as { code: string; field?: string }
      assert.equal(body.field, 'name')
    })
  })

  test('NotFoundError → 404', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/introuvable`)
      assert.equal(res.status, 404)
    })
  })

  test('ConflictError → 409', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/conflit`)
      assert.equal(res.status, 409)
      const body = (await res.json()) as { code: string; message: string }
      assert.equal(body.code, 'CONFLICT')
      assert.equal(body.message, 'gameId déjà pris')
    })
  })

  test('erreur inconnue → 500 loggée, sans fuite du détail', async (t) => {
    const spy = t.mock.method(console, 'error', () => {})
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/api/boom`)
      assert.equal(res.status, 500)
      const body = (await res.json()) as { code: string; message: string }
      assert.equal(body.code, 'INTERNAL')
      assert.ok(!body.message.includes('secret'))
    })
    assert.ok(spy.mock.calls.length >= 1)
  })
})

describe('router — fallback hors /api', () => {
  test('délègue les chemins hors /api au fallback fourni', async () => {
    const router = createRouter(routes, {
      fallback: (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('statique')
      },
    })
    await withServer(router, async (base) => {
      const res = await fetch(`${base}/nimporte/quoi`)
      assert.equal(res.status, 200)
      assert.equal(await res.text(), 'statique')
    })
  })

  test('sans fallback, un chemin hors /api → 404', async () => {
    await withServer(createRouter(routes), async (base) => {
      const res = await fetch(`${base}/hello`)
      assert.equal(res.status, 404)
    })
  })
})

describe('createApp — racine de composition', () => {
  test('GET /api/health répond ok', async () => {
    const db = openDb(':memory:')
    await withServer(createApp(db), async (base) => {
      const res = await fetch(`${base}/api/health`)
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { status: 'ok' })
    })
  })
})
