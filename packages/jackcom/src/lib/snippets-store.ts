import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Snippet {
  id: string
  name: string
  data: string // HEX 字符串
  createdAt: number
}

interface SnippetsStore {
  snippets: Snippet[]
  add: (name: string, data: string) => void
  remove: (id: string) => void
}

export const useSnippetsStore = create<SnippetsStore>()(
  persist(
    (set) => ({
      snippets: [],

      add: (name, data) =>
        set((s) => ({
          snippets: [
            ...s.snippets,
            {
              id: crypto.randomUUID(),
              name,
              data,
              createdAt: Date.now(),
            },
          ],
        })),

      remove: (id) =>
        set((s) => ({
          snippets: s.snippets.filter(sn => sn.id !== id),
        })),
    }),
    {
      name: 'jackcom:snippets',
    },
  ),
)
