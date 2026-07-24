import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { resolveAppPaths } from '../electron/paths.ts'

describe('resolveAppPaths', () => {
  test('place la base et les avatars dans le dossier utilisateur, pas relatif au cwd (#41)', () => {
    const paths = resolveAppPaths('/Users/paul/AppData/CodexKeizaal', '/app/resources/app')
    assert.equal(paths.dbPath, join('/Users/paul/AppData/CodexKeizaal', 'codex.db'))
    assert.equal(paths.avatarsDir, join('/Users/paul/AppData/CodexKeizaal', 'avatars'))
  })

  test('sert dist/ et public/ depuis la racine de l’app, le dossier utilisateur en repli (pour /avatars)', () => {
    const paths = resolveAppPaths('/data', '/app')
    assert.deepEqual(paths.staticRoots, [join('/app', 'dist'), join('/app', 'public'), '/data'])
  })

  test('cherche le seed des POI dans config/ à la racine de l’app, pas du dossier utilisateur', () => {
    const paths = resolveAppPaths('/data', '/app')
    assert.equal(paths.poisSeedPath, join('/app', 'config', 'pois.json'))
  })
})
