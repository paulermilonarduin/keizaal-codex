import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticHandler } from '../server/lib/static.ts'
import { withServer } from './helpers.ts'

const tempDir = mkdtempSync(join(tmpdir(), 'codex-static-test-'))
after(() => rmSync(tempDir, { recursive: true, force: true }))

const root = join(tempDir, 'public')
const secondRoot = join(tempDir, 'extra')
mkdirSync(join(root, 'img'), { recursive: true })
mkdirSync(secondRoot, { recursive: true })
writeFileSync(join(root, 'index.html'), '<h1>Codex</h1>')
writeFileSync(join(root, 'app.js'), 'console.log(1)')
writeFileSync(join(root, 'notes.txt'), 'extension interdite')
writeFileSync(join(root, 'img', 'logo.svg'), '<svg></svg>')
writeFileSync(join(secondRoot, 'carte.webp'), 'fake-webp')
writeFileSync(join(tempDir, 'secret.html'), 'hors racine')

const handler = createStaticHandler([root, secondRoot])

describe('static — fichiers servis', () => {
  test('sert index.html sur /', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/`)
      assert.equal(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /text\/html/)
      assert.equal(await res.text(), '<h1>Codex</h1>')
    })
  })

  test('sert un fichier js avec le bon content-type', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/app.js`)
      assert.equal(res.status, 200)
      assert.match(res.headers.get('content-type') ?? '', /javascript/)
      assert.equal(await res.text(), 'console.log(1)')
    })
  })

  test('sert un fichier dans un sous-dossier', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/img/logo.svg`)
      assert.equal(res.status, 200)
      assert.equal(await res.text(), '<svg></svg>')
    })
  })

  test('cherche dans les racines suivantes si absent de la première', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/carte.webp`)
      assert.equal(res.status, 200)
      assert.equal(await res.text(), 'fake-webp')
    })
  })
})

describe('static — sécurité', () => {
  test('fichier inexistant → 404', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/missing.js`)
      assert.equal(res.status, 404)
    })
  })

  test('extension hors whitelist → 404', async () => {
    await withServer(handler, async (base) => {
      const res = await fetch(`${base}/notes.txt`)
      assert.equal(res.status, 404)
    })
  })

  test('traversée de chemin encodée → 404', async () => {
    await withServer(handler, async (base) => {
      for (const path of ['/%2e%2e/secret.html', '/..%2Fsecret.html', '/img/%2e%2e/%2e%2e/secret.html']) {
        const res = await fetch(`${base}${path}`)
        assert.equal(res.status, 404, `le chemin ${path} ne doit pas sortir de la racine`)
      }
    })
  })
})
