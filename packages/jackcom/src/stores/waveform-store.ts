import { create } from 'zustand'

interface WaveformStore {
  portId: string | null
  channels: Record<string, number[]> // channel name → last N values
  timeWindow: number // seconds
  paused: boolean
  maxPoints: number

  setPortId: (id: string) => void
  addData: (channel: string, value: number) => void
  togglePause: () => void
  setTimeWindow: (seconds: number) => void
  clear: () => void
}

export const useWaveformStore = create<WaveformStore>(set => ({
  portId: null,
  channels: {},
  timeWindow: 10,
  paused: false,
  maxPoints: 500,

  setPortId: id => set({ portId: id }),
  addData: (channel, value) =>
    set((s) => {
      const current = s.channels[channel] ?? []
      const newValues = [...current, value].slice(-s.maxPoints)
      return { channels: { ...s.channels, [channel]: newValues } }
    }),
  togglePause: () => set(s => ({ paused: !s.paused })),
  setTimeWindow: seconds => set({ timeWindow: seconds }),
  clear: () => set({ channels: {} }),
}))
