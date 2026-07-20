// Seule entorse au « pas de classes » du projet : c'est l'idiome JS pour
// permettre le `instanceof` dans le try/catch central du routeur.

export class ValidationError extends Error {
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Ressource introuvable') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflit avec une ressource existante') {
    super(message)
    this.name = 'ConflictError'
  }
}
