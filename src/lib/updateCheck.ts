import { z } from 'zod'

// L'API publique des releases suffit : elle répond en CORS ouvert, le front
// interroge donc GitHub directement sans passer par le serveur embarqué (#94).
// Toutes les releases plutôt que /latest : si plusieurs versions ont été
// ratées, la modale cumule les patch notes depuis la version installée.
const RELEASES_URL =
  'https://api.github.com/repos/paulermilonarduin/keizaal-codex/releases?per_page=100'

// Schéma local et non partagé : ce n'est pas un contrat client-serveur du
// codex, mais la forme d'une réponse tierce dont on ne lit que quatre champs
// (`.loose()` laisse passer tout le reste).
const releaseSchema = z
  .object({
    tag_name: z.string(),
    body: z.string().nullable().optional(),
    html_url: z.string(),
    prerelease: z.boolean(),
  })
  .loose()

const releasesSchema = z.array(releaseSchema)

export type GithubRelease = z.infer<typeof releaseSchema>
export type ReleaseInfo = { version: string; body: string; url: string }
export type VersionParts = { major: number; minor: number; patch: number }

// Les tags du repo sont strictement `vX.Y.Z`, alignés sur package.json : tout
// le reste (nightly, suffixe de prerelease) est ignoré plutôt que deviné.
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(tag: string): VersionParts | null {
  const match = VERSION_PATTERN.exec(tag.trim())
  if (match === null) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

function compare(a: VersionParts, b: VersionParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

export function isNewer(candidate: string, current: string): boolean {
  const parsedCandidate = parseVersion(candidate)
  const parsedCurrent = parseVersion(current)
  if (parsedCandidate === null || parsedCurrent === null) return false
  return compare(parsedCandidate, parsedCurrent) > 0
}

export function selectNewerReleases(
  releases: GithubRelease[],
  currentVersion: string,
): ReleaseInfo[] {
  const selected: { info: ReleaseInfo; parts: VersionParts }[] = []
  for (const release of releases) {
    // Les prereleases sont incluses par l'API : on ne notifie que du stable.
    if (release.prerelease) continue
    const parts = parseVersion(release.tag_name)
    if (parts === null) continue
    if (compare(parts, parseVersion(currentVersion) ?? parts) <= 0) continue
    selected.push({
      info: {
        version: `${parts.major}.${parts.minor}.${parts.patch}`,
        body: release.body ?? '',
        url: release.html_url,
      },
      parts,
    })
  }
  // Plus récente en premier : c'est l'ordre de lecture de la modale.
  selected.sort((a, b) => compare(b.parts, a.parts))
  return selected.map((entry) => entry.info)
}

/**
 * `null` en cas d'échec (hors ligne, rate limit, réponse inattendue) : la
 * vérification de mise à jour est un bonus, elle ne doit jamais remonter
 * d'erreur à l'utilisateur. `[]` signifie « à jour ».
 */
export async function checkForUpdates(
  currentVersion: string,
  fetchFn: typeof fetch = fetch,
): Promise<ReleaseInfo[] | null> {
  if (parseVersion(currentVersion) === null) return null
  try {
    const response = await fetchFn(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null
    const parsed = releasesSchema.safeParse(await response.json())
    if (!parsed.success) return null
    return selectNewerReleases(parsed.data, currentVersion)
  } catch {
    return null
  }
}
