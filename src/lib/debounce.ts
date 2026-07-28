export type Debounced<A extends readonly unknown[]> = ((...args: A) => void) & {
  // flush : envoyer tout de suite ce qui attend (fermeture de l'application).
  flush: () => void
  // cancel : abandonner ce qui attend (un import va remplacer l'état).
  cancel: () => void
}

// Exception assumée à l'écriture pessimiste du projet (cf. CLAUDE.md) : une zone
// de notes reçoit une frappe continue, un aller-retour serveur par caractère n'a
// pas de sens. Réservé aux notes générales (#72) et aux notes d'histoire (#83),
// le reste de l'application n'en use pas.
export function debounce<A extends readonly unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined

  function run(...args: A): void {
    pending = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      const args = pending
      pending = undefined
      if (args !== undefined) fn(...args)
    }, delayMs)
  }

  run.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }

  run.flush = (): void => {
    const args = pending
    // Le timer est purgé avant l'appel : sans ça il rejouerait après un flush
    // et l'on enverrait deux fois la même écriture.
    run.cancel()
    if (args !== undefined) fn(...args)
  }

  return run
}
