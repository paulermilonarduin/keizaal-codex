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
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const error = (await res.json()) as ApiErrorPayload
      throw new HttpError(res.status, error)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  }
}
