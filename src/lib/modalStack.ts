export interface ModalStack {
  push(token: object): void
  remove(token: object): void
  isTop(token: object): boolean
}

// Ordre d'empilement des modales ouvertes (#107) : sans elle, chaque ModalShell
// écoutant keydown sur document, un seul Échap fermait toute la pile et perdait
// la saisie de la modale du dessous. Identité des tokens par référence : un
// objet vide par instance de ModalShell suffit.
export function createModalStack(): ModalStack {
  const tokens: object[] = []

  return {
    push(token: object): void {
      tokens.push(token)
    },
    // Retrait par valeur et non pop() : rien ne garantit que Vue démonte les
    // modales dans l'ordre inverse de leur montage.
    remove(token: object): void {
      const index = tokens.indexOf(token)
      if (index !== -1) tokens.splice(index, 1)
    },
    isTop(token: object): boolean {
      return tokens.length > 0 && tokens[tokens.length - 1] === token
    },
  }
}

// Instance partagée par tous les ModalShell de l'application (mono-fenêtre).
export const modalStack: ModalStack = createModalStack()
