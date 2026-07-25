// Sections de la sidebar, présentées comme des intercalaires de classeur.
// Objet `as const` + type dérivé (pas d'`enum` TS : le type stripping de Node
// ne l'accepte pas, cf. CLAUDE.md).
export const SIDEBAR_TABS = ['characters', 'groups', 'pois'] as const
export type SidebarTab = (typeof SIDEBAR_TABS)[number]

// Record : TypeScript casse à la compilation si un onglet est ajouté sans
// libellé.
export const SIDEBAR_TAB_LABELS: Record<SidebarTab, string> = {
  characters: 'Personnages',
  groups: 'Groupes',
  pois: "Points d'intérêt",
}

export type TabMove = 'previous' | 'next' | 'first' | 'last'

// Navigation clavier du pattern ARIA « tabs » : les flèches bouclent aux
// extrémités, Origine/Fin sautent directement au bord.
export function nextTab(current: SidebarTab, move: TabMove): SidebarTab {
  // Le tuple est non vide par construction, mais noUncheckedIndexedAccess
  // impose de le prouver au compilateur.
  const first: SidebarTab = SIDEBAR_TABS[0]
  if (move === 'first') return first
  if (move === 'last') return SIDEBAR_TABS[SIDEBAR_TABS.length - 1] ?? first

  const index = SIDEBAR_TABS.indexOf(current)
  const offset = move === 'next' ? 1 : -1
  const wrapped = (index + offset + SIDEBAR_TABS.length) % SIDEBAR_TABS.length
  return SIDEBAR_TABS[wrapped] ?? first
}
