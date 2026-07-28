import { app, BrowserWindow, Menu, shell } from 'electron'
import http from 'node:http'
import type { Server } from 'node:http'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { openDb } from '../server/db.ts'
import { createApp } from '../server/server.ts'
import { resolveAppPaths } from './paths.ts'

let server: Server | null = null

// Port éphémère : jamais de conflit avec une instance `npm start` déjà
// lancée, et cette app n'a besoin d'aucun port fixe puisque front et API
// sont servis par le même process (pas de proxy Vite en production).
function startServer(): Promise<number> {
  const paths = resolveAppPaths(app.getPath('userData'), app.getAppPath())
  mkdirSync(app.getPath('userData'), { recursive: true })

  const db = openDb(paths.dbPath)
  const httpApp = createApp(db, { staticRoots: paths.staticRoots, avatarsDir: paths.avatarsDir })

  return new Promise((resolve) => {
    server = http.createServer(httpApp)
    server.listen(0, '127.0.0.1', () => {
      const address = server?.address()
      resolve(typeof address === 'object' && address !== null ? address.port : 0)
    })
  })
}

async function createWindow(): Promise<void> {
  const port = await startServer()
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    autoHideMenuBar: true,
    backgroundColor: '#2e3442',
    icon: join(app.getAppPath(), 'build', 'icon.ico'),
  })

  // Les liens externes (page de release, liens des patch notes) partent vers le
  // navigateur système : sans ça Electron ouvrirait une fenêtre sans barre
  // d'adresse ni navigation, inutilisable (#94).
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Filet pour un lien sans target: sinon la page GitHub remplacerait l'app.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  await win.loadURL(`http://127.0.0.1:${port}`)
}

Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  server?.close()
  if (process.platform !== 'darwin') app.quit()
})
