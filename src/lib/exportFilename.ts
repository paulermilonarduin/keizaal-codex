// Nom de fichier d'export (CDC §5.4) : dérivé de la date d'export du bundle
// lui-même, autorité unique, plutôt que de l'horloge locale au téléchargement.
export function exportFilename(exportedAt: string): string {
  return `codex-keizaal-${exportedAt.slice(0, 10)}.json`
}
