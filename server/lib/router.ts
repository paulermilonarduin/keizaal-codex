import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import { ZodError } from 'zod'
import { ConflictError, NotFoundError, ValidationError } from './errors.ts'

export type RouteRequest = {
  params: Record<string, string>
  body: unknown
  query: URLSearchParams
}

export type RouteResult = { status: number; body?: unknown }

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  // Si vrai, le body n'est pas parsé en JSON : le handler reçoit le Buffer brut
  // (upload d'avatar : body binaire, pas de multipart).
  raw?: boolean
  handler: (request: RouteRequest) => RouteResult | Promise<RouteResult>
}

type CompiledRoute = Route & { pattern: RegExp; paramNames: string[] }

export function createRouter(
  routes: readonly Route[],
  options: { fallback?: RequestListener } = {},
): RequestListener {
  const compiled = routes.map(compile)
  return (req, res) => {
    void dispatch(compiled, options.fallback, req, res)
  }
}

function compile(route: Route): CompiledRoute {
  const paramNames: string[] = []
  const source = route.path.replace(/:[^/]+/g, (segment) => {
    paramNames.push(segment.slice(1))
    return '([^/]+)'
  })
  return { ...route, pattern: new RegExp(`^${source}$`), paramNames }
}

async function dispatch(
  routes: readonly CompiledRoute[],
  fallback: RequestListener | undefined,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')

  let matched: { route: CompiledRoute; captures: string[] } | undefined
  for (const route of routes) {
    if (route.method !== req.method) continue
    const match = route.pattern.exec(url.pathname)
    if (match !== null) {
      matched = { route, captures: match.slice(1) }
      break
    }
  }

  if (matched === undefined) {
    if (!url.pathname.startsWith('/api') && fallback !== undefined) return fallback(req, res)
    return sendJson(res, 404, { code: 'NOT_FOUND', message: 'Route inconnue' })
  }

  try {
    const body = matched.route.raw ? await readRawBody(req) : await readJsonBody(req)
    const params: Record<string, string> = {}
    matched.route.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(matched.captures[index] ?? '')
    })
    const result = await matched.route.handler({ params, body, query: url.searchParams })
    sendJson(res, result.status, result.body)
  } catch (error) {
    const { status, payload } = toHttpPayload(error)
    if (status === 500) console.error(error)
    sendJson(res, status, payload)
  }
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new ValidationError('Body JSON invalide')
  }
}

function toHttpPayload(error: unknown): {
  status: number
  payload: { code: string; message: string; field?: string }
} {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    return {
      status: 400,
      payload: {
        code: 'VALIDATION',
        message: issue?.message ?? 'Données invalides',
        field: issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : undefined,
      },
    }
  }
  if (error instanceof ValidationError) {
    return { status: 400, payload: { code: 'VALIDATION', message: error.message, field: error.field } }
  }
  if (error instanceof NotFoundError) {
    return { status: 404, payload: { code: 'NOT_FOUND', message: error.message } }
  }
  if (error instanceof ConflictError) {
    return { status: 409, payload: { code: 'CONFLICT', message: error.message } }
  }
  return { status: 500, payload: { code: 'INTERNAL', message: 'Erreur interne du serveur' } }
}

function sendJson(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body === undefined ? undefined : JSON.stringify(body))
}
