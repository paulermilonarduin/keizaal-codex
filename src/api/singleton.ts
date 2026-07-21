import { createHttpClient } from './http.ts'
import { createApiClient } from './endpoints.ts'

// Instance unique de l'app : même origine que le serveur (proxy Vite en dev,
// même serveur Node en prod), pas de config d'hôte nécessaire.
export const api = createApiClient(createHttpClient('/api'))
