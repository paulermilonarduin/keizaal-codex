import { z } from 'zod'
import { POI_TYPES, RACES, RELATIONS } from './enums.ts'

export const uuid = z.uuid()
const requiredText = z.string().trim().min(1)
const coordinate = z.number().finite()
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #RRGGBB')

// Une seule position par personnage (#80), réduite à ses coordonnées : le
// libellé du lieu n'était plus saisissable depuis #79, et le « vu le » se note
// en texte libre dans la note (décision projet).
export const positionSchema = z.object({
  x: coordinate,
  y: coordinate,
})

// Identité minimale : name OU gameId (cahier des charges §4).
const hasIdentity = (value: { name?: string; gameId?: string }) =>
  value.name !== undefined || value.gameId !== undefined
const identityRule = { message: 'Un nom ou un gameId est requis', path: ['name'] }

const characterFields = z.object({
  gameId: requiredText.optional(),
  name: requiredText.optional(),
  race: z.enum(RACES).default('Inconnue'),
  relation: z.enum(RELATIONS).default('inconnu'),
  role: requiredText.optional(),
  note: z.string().optional(),
  groups: z.array(uuid).default([]),
  position: positionSchema.optional(),
})

export const characterInputSchema = characterFields.refine(hasIdentity, identityRule)

export const characterSchema = characterFields
  .extend({
    id: uuid,
    avatar: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(hasIdentity, identityRule)

export const groupInputSchema = z.object({
  name: requiredText,
  color: hexColor.optional(),
  description: z.string().optional(),
})

export const groupSchema = groupInputSchema.extend({ id: uuid })

// Notes générales : texte libre, mais borné. Sans plafond, un copier-coller
// accidentel de plusieurs Mo partirait en base sans contrôle (#72).
export const NOTES_MAX_LENGTH = 100_000
export const notesInputSchema = z.object({
  text: z.string().max(NOTES_MAX_LENGTH),
})

export const poiInputSchema = z.object({
  name: requiredText,
  type: z.enum(POI_TYPES).default('landmark'),
  x: coordinate,
  y: coordinate,
})

export const poiSchema = poiInputSchema.extend({ id: uuid })

// Histoires (#83) : des notes spécifiques reliées à des personnages, des
// groupes et des lieux existants. Le titre est la seule identité obligatoire,
// tout le reste est facultatif — une histoire peut n'être qu'un titre.
export const storyInputSchema = z.object({
  title: requiredText,
  // Date ISO et non texte libre : le champ est un <input type="date">, et une
  // date structurée reste triable plus tard.
  date: z.iso.date().optional(),
  notes: z.string().max(NOTES_MAX_LENGTH).default(''),
  characters: z.array(uuid).default([]),
  groups: z.array(uuid).default([]),
  pois: z.array(uuid).default([]),
})

export const storySchema = storyInputSchema.extend({ id: uuid })

// Compat des bundles antérieurs à #80, qui portaient deux positions. L'export
// tient lieu de sauvegarde (README §Données) : sans cette reprise, réimporter
// un ancien fichier perdrait toutes les positions en silence. Même règle que la
// migration de base : la connue devient la position, la générale est abandonnée
// (`homePosition`, `label` et `date` tombent au parse, clés inconnues).
const importedCharacterSchema = z.preprocess((value) => {
  if (value === null || typeof value !== 'object') return value
  const character = value as Record<string, unknown>
  if (character.position !== undefined || character.knownPosition === undefined) return character
  return { ...character, position: character.knownPosition }
}, characterSchema)

// Bundle autonome d'export/import : avatars en base64, clé = nom de fichier
// (<uuid>.webp), cohérent avec le champ `avatar` (`avatars/<uuid>.webp`) des
// personnages qui en portent un.
export const transferBundleSchema = z.object({
  exportedAt: z.iso.datetime(),
  characters: z.array(importedCharacterSchema),
  groups: z.array(groupSchema),
  pois: z.array(poiSchema),
  avatars: z.record(z.string(), z.string()),
  // Défaut plutôt qu'obligatoire : les fichiers exportés avant #72 n'ont pas
  // cette clé et doivent rester importables.
  notes: z.string().max(NOTES_MAX_LENGTH).default(''),
})

export type Position = z.infer<typeof positionSchema>
// z.input (pas z.infer) : race/relation/groups ont un défaut, donc
// facultatifs à l'appel — z.infer donnerait le type post-parse (obligatoires).
export type CharacterInput = z.input<typeof characterInputSchema>
export type Character = z.infer<typeof characterSchema>
export type GroupInput = z.infer<typeof groupInputSchema>
export type Group = z.infer<typeof groupSchema>
export type PoiInput = z.input<typeof poiInputSchema>
export type Poi = z.infer<typeof poiSchema>
// z.input : notes et les trois tableaux de liens ont un défaut, ils sont donc
// facultatifs à l'appel.
export type StoryInput = z.input<typeof storyInputSchema>
export type Story = z.infer<typeof storySchema>
export type NotesInput = z.infer<typeof notesInputSchema>
// z.infer : `notes` a un défaut, il est donc garanti présent après parse.
export type TransferBundle = z.infer<typeof transferBundleSchema>
