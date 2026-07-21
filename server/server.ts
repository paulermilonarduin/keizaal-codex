import http from 'node:http'
import { mkdirSync, readFileSync } from 'node:fs'
import type { RequestListener } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { createRouter, type Route } from './lib/router.ts'
import { createStaticHandler } from './lib/static.ts'
import * as charactersRepo from './repositories/characters.repo.ts'
import * as groupsRepo from './repositories/groups.repo.ts'
import * as poisRepo from './repositories/pois.repo.ts'
import { createCharactersService } from './services/characters.service.ts'
import { createGroupsService } from './services/groups.service.ts'
import { createPoisService } from './services/pois.service.ts'
import { createAvatarsService } from './services/avatars.service.ts'
import { createTransferService } from './services/transfer.service.ts'
import { createCharactersRoutes } from './routes/characters.routes.ts'
import { createGroupsRoutes } from './routes/groups.routes.ts'
import { createPoisRoutes } from './routes/pois.routes.ts'
import { createDataRoutes } from './routes/data.routes.ts'
import { createAvatarsRoutes } from './routes/avatars.routes.ts'
import { createTransferRoutes } from './routes/transfer.routes.ts'

const PORT = 4750

export function createApp(
  db: DatabaseSync,
  options: { staticRoots?: readonly string[]; avatarsDir?: string } = {},
): RequestListener {
  const characters = createCharactersService({ db, charactersRepo })
  const groups = createGroupsService({ db, groupsRepo })
  const pois = createPoisService({ db, poisRepo })
  const avatars = createAvatarsService({ db, charactersRepo, avatarsDir: options.avatarsDir })
  const transfer = createTransferService({
    db,
    charactersRepo,
    groupsRepo,
    poisRepo,
    avatarsDir: options.avatarsDir,
  })
  const routes: Route[] = [
    { method: 'GET', path: '/api/health', handler: () => ({ status: 200, body: { status: 'ok' } }) },
    ...createDataRoutes(characters, groups, pois),
    ...createCharactersRoutes(characters),
    ...createGroupsRoutes(groups),
    ...createPoisRoutes(pois),
    ...createAvatarsRoutes(avatars),
    ...createTransferRoutes(transfer),
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
