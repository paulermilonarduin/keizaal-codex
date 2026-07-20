import http from 'node:http'
import { mkdirSync, readFileSync } from 'node:fs'
import type { RequestListener } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { createRouter, type Route } from './lib/router.ts'
import { createStaticHandler } from './lib/static.ts'
import * as charactersRepo from './repositories/characters.repo.ts'
import { createCharactersService } from './services/characters.service.ts'
import { createCharactersRoutes } from './routes/characters.routes.ts'

const PORT = 4750

export function createApp(
  db: DatabaseSync,
  options: { staticRoots?: readonly string[] } = {},
): RequestListener {
  const characters = createCharactersService({ db, charactersRepo })
  const routes: Route[] = [
    { method: 'GET', path: '/api/health', handler: () => ({ status: 200, body: { status: 'ok' } }) },
    ...createCharactersRoutes(characters),
  ]
  const fallback =
    options.staticRoots !== undefined ? createStaticHandler(options.staticRoots) : undefined
  return createRouter(routes, { fallback })
}

function readPoisSeed(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined // pas de seed : base vide, cas assumé
  }
}

if (import.meta.main) {
  mkdirSync('data', { recursive: true })
  const db = openDb('data/codex.db', { poisSeed: readPoisSeed('config/pois.json') })
  const app = createApp(db, { staticRoots: ['dist', 'public'] })
  http.createServer(app).listen(PORT, () => {
    console.log(`Codex Keizaal : http://localhost:${PORT}`)
  })
}
