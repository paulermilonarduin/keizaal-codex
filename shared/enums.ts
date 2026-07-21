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
