export interface ModalStack {
  push(token: object): void
  remove(token: object): void
  isTop(token: object): boolean
}

export function createModalStack(): ModalStack {
  function notImplemented(): never {
    throw new Error('modalStack : pas encore implémenté')
  }
  return { push: notImplemented, remove: notImplemented, isTop: notImplemented }
}

// Instance partagée par tous les ModalShell de l'application (mono-fenêtre).
export const modalStack: ModalStack = createModalStack()
