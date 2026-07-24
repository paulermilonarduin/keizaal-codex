import { HttpError } from '../api/http.ts'

// Message affichable pour une erreur d'action (CDC/backlog #18 : messages
// d'erreur partout) : celui du serveur pour une HttpError, un repli sinon.
export function describeError(error: unknown, fallback = 'Une erreur est survenue.'): string {
  return error instanceof HttpError ? error.message : fallback
}
