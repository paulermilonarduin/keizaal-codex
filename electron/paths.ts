import { join } from 'node:path'

export type AppPaths = {
  dbPath: string
  avatarsDir: string
  staticRoots: string[]
}

// Séparation stricte (#41) : la base et les avatars vivent dans le dossier
// utilisateur (persistants d'une version à l'autre de l'app), le reste
// (front buildé) dans les ressources de l'app elle-même.
export function resolveAppPaths(userDataDir: string, appRoot: string): AppPaths {
  return {
    dbPath: join(userDataDir, 'codex.db'),
    avatarsDir: join(userDataDir, 'avatars'),
    staticRoots: [join(appRoot, 'dist'), join(appRoot, 'public'), userDataDir],
  }
}
