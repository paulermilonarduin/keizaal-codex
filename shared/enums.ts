// Objets `as const` + types dérivés : les enum TS ne survivent pas au type
// stripping de Node (syntaxe non effaçable).

export const RACES = [
  'Nordique',
  'Impérial',
  'Bréton',
  'Rougegarde',
  'Haut-elfe',
  'Elfe des bois',
  'Elfe noir',
  'Orque',
  'Khajiit',
  'Argonien',
  'Inconnue',
] as const
export type Race = (typeof RACES)[number]

export const RELATIONS = ['ami', 'neutre', 'ennemi', 'inconnu'] as const
export type Relation = (typeof RELATIONS)[number]

// Un type par icône disponible dans public/icons/pois/ (cf. ticket #14).
export const POI_TYPES = [
  'capitale',
  'ville',
  'village',
  'orc-stronghold',
  'fort',
  'keep',
  'camp',
  'giant-camp',
  'farm',
  'shack',
  'cave',
  'mine',
  'dwemer',
  'nordic-ruin',
  'dragon-lair',
  'shrine',
  'standing-stones',
  'docks',
  'lighthouse',
  'landmark',
] as const
export type PoiType = (typeof POI_TYPES)[number]

// Les valeurs de POI_TYPES sont des identifiants techniques (elles nomment les
// icônes) : l'UI a besoin de libellés lisibles. Record, donc ajouter un type
// sans son libellé casse la compilation.
export const POI_TYPE_LABELS: Record<PoiType, string> = {
  capitale: 'Capitale',
  ville: 'Ville',
  village: 'Village',
  'orc-stronghold': 'Camp orque',
  fort: 'Fort',
  keep: 'Donjon',
  camp: 'Camp',
  'giant-camp': 'Camp de géants',
  farm: 'Ferme',
  shack: 'Cabane',
  cave: 'Grotte',
  mine: 'Mine',
  dwemer: 'Ruine dwemer',
  'nordic-ruin': 'Ruine nordique',
  'dragon-lair': 'Repaire de dragon',
  shrine: 'Sanctuaire',
  'standing-stones': 'Pierres de garde',
  docks: 'Docks',
  lighthouse: 'Phare',
  landmark: 'Repère',
}
