export type ApiErrorPayload = { code: string; message: string; field?: string }

export class HttpError extends Error {
  status: number
  code: string
  field?: string

  constructor(status: number, error: ApiErrorPayload) {
    super(error.message)
    this.name = 'HttpError'
    this.status = status
    this.code = error.code
    this.field = error.field
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>

export function createHttpClient(baseUrl: string) {
  async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const error = (await res.json()) as ApiErrorPayload
      throw new HttpError(res.status, error)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  // `keepalive` laisse la requête aboutir alors que la page se ferme : sans lui,
  // l'enregistrement déclenché sur beforeunload serait annulé (#72). Attention,
  // la spécification plafonne le corps d'une requête keepalive à 64 Ko —
  // l'appelant doit donc s'abstenir au-delà (cf. notes.store).
  type Options = { keepalive?: boolean }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: Options = {},
  ): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(options.keepalive === true ? { keepalive: true } : {}),
    })
    return handleResponse<T>(res)
  }

  // Body binaire brut (pas de JSON) : upload d'avatar.
  async function requestBinary<T>(method: string, path: string, body: BodyInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { method, body })
    return handleResponse<T>(res)
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown, options?: Options) =>
      request<T>('PUT', path, body, options),
    delete: <T>(path: string) => request<T>('DELETE', path),
    postBinary: <T>(path: string, body: BodyInit) => requestBinary<T>('POST', path, body),
  }
}
