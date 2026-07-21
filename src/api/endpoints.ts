import type { HttpClient } from './http.ts'
import type {
  Character,
  CharacterInput,
  Group,
  GroupInput,
  Poi,
  PoiInput,
} from '../../shared/schemas.ts'

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(http: HttpClient) {
  return {
    data: {
      getAll: () =>
        http.get<{ characters: Character[]; groups: Group[]; pois: Poi[] }>('/data'),
    },
    characters: {
      create: (input: CharacterInput) => http.post<Character>('/characters', input),
      update: (id: string, input: CharacterInput) =>
        http.put<Character>(`/characters/${id}`, input),
      remove: (id: string) => http.delete<void>(`/characters/${id}`),
    },
    groups: {
      create: (input: GroupInput) => http.post<Group>('/groups', input),
      update: (id: string, input: GroupInput) => http.put<Group>(`/groups/${id}`, input),
      remove: (id: string) => http.delete<void>(`/groups/${id}`),
    },
    pois: {
      create: (input: PoiInput) => http.post<Poi>('/pois', input),
      update: (id: string, input: PoiInput) => http.put<Poi>(`/pois/${id}`, input),
      remove: (id: string) => http.delete<void>(`/pois/${id}`),
    },
    avatars: {
      upload: (id: string, blob: Blob) => http.postBinary<Character>(`/avatars/${id}`, blob),
      remove: (id: string) => http.delete<void>(`/avatars/${id}`),
    },
  }
}
