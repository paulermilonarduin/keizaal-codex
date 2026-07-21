import { z } from 'zod'
import { POI_TYPES, RACES, RELATIONS } from './enums.ts'

export const uuid = z.uuid()
const requiredText = z.string().trim().min(1)
const coordinate = z.number().finite()
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #RRGGBB')

export const positionSchema = z.object({
  x: coordinate,
  y: coordinate,
  label: requiredText.optional(),
})

// Seule la position connue porte une date (« vu le »), optionnelle.
export const knownPositionSchema = positionSchema.extend({
  date: z.iso.date().optional(),
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
  homePosition: positionSchema.optional(),
  knownPosition: knownPositionSchema.optional(),
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

export const poiInputSchema = z.object({
  name: requiredText,
  type: z.enum(POI_TYPES).default('landmark'),
  x: coordinate,
  y: coordinate,
})

export const poiSchema = poiInputSchema.extend({ id: uuid })

// Bundle autonome d'export/import : avatars en base64, clé = nom de fichier
// (<uuid>.webp), cohérent avec le champ `avatar` (`avatars/<uuid>.webp`) des
// personnages qui en portent un.
export const transferBundleSchema = z.object({
  exportedAt: z.iso.datetime(),
  characters: z.array(characterSchema),
  groups: z.array(groupSchema),
  pois: z.array(poiSchema),
  avatars: z.record(z.string(), z.string()),
})

export type Position = z.infer<typeof positionSchema>
export type KnownPosition = z.infer<typeof knownPositionSchema>
export type CharacterInput = z.infer<typeof characterInputSchema>
export type Character = z.infer<typeof characterSchema>
export type GroupInput = z.infer<typeof groupInputSchema>
export type Group = z.infer<typeof groupSchema>
export type PoiInput = z.infer<typeof poiInputSchema>
export type Poi = z.infer<typeof poiSchema>
export type TransferBundle = z.infer<typeof transferBundleSchema>
