import { create } from 'zustand'
import type { DisplayFrame } from '@/lib/tauri-events'

interface DecoderStore {
  portId: string | null
  protocol: string | null
  currentFrame: DisplayFrame | null
  pinnedFrame: DisplayFrame | null
  autoScroll: boolean

  setPortId: (id: string) => void
  setCurrentFrame: (frame: DisplayFrame | null) => void
  pinFrame: (frame: DisplayFrame | null) => void
  setAutoScroll: (auto: boolean) => void
}

export const useDecoderStore = create<DecoderStore>((set) => ({
  portId: null,
  protocol: null,
  currentFrame: null,
  pinnedFrame: null,
  autoScroll: true,

  setPortId: (id) => set({ portId: id }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  pinFrame: (frame) => set({ pinnedFrame: frame }),
  setAutoScroll: (auto) => set({ autoScroll: auto }),
}))
