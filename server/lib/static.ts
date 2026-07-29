import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import type { RequestListener, ServerResponse } from 'node:http'

// Whitelist stricte : tout le reste (dont .db, .ts, dotfiles) est refusé.
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function createStaticHandler(roots: readonly string[]): RequestListener {
  const resolvedRoots = roots.map((root) => resolve(root))

  return (req, res) => {
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    } catch {
      return notFound(res)
    }
    if (pathname === '/') pathname = '/index.html'

    const contentType = CONTENT_TYPES[extname(pathname).toLowerCase()]
    if (contentType === undefined) return notFound(res)

    for (const root of resolvedRoots) {
      const filePath = resolve(join(root, pathname))
      if (!filePath.startsWith(root + sep)) continue
      if (!existsSync(filePath) || !statSync(filePath).isFile()) continue
      // Un avatar remplacé garde le même nom de fichier : sans revalidation, le
      // navigateur resservirait l'ancienne image après rechargement (#108). Le
      // reste des fichiers statiques garde le comportement par défaut.
      const headers: Record<string, string> = { 'content-type': contentType }
      if (pathname.startsWith('/avatars/')) headers['cache-control'] = 'no-cache'
      res.writeHead(200, headers)
      createReadStream(filePath).pipe(res)
      return
    }
    notFound(res)
  }
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('404')
}
