import { NotFoundError } from './errors.ts'

export function requireFound<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new NotFoundError(message)
  return value
}
