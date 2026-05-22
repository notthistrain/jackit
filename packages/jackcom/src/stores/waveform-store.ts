import { create } from 'zustand'

interface WaveformStore {
  portId: string | null
  channels: Record<string, number[]> // channel name → last N values
  timeWindow: number // seconds
  paused: boolean
  maxPoints: number

  setPortId: (id: string) => void
  addData: (channel: string, value: number) => void
  addDataBatch: (entries: [channel: string, value: number][]) => void
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
  addDataBatch: (entries) => {
    // Group entries by channel to reduce intermediate array creation
    const grouped = new Map<string, number[]>()
    for (const [ch, val] of entries) {
      const arr = grouped.get(ch)
      if (arr)
        arr.push(val)
      else
        grouped.set(ch, [val])
    }

    return set((s) => {
      const updated = { ...s.channels }
      for (const [channel, newValues] of grouped) {
        const current = updated[channel]
        if (current && current.length + newValues.length <= s.maxPoints) {
          updated[channel] = current.concat(newValues)
        }
        else {
          const combined = current ? [...current, ...newValues] : newValues
          updated[channel] = combined.length > s.maxPoints
            ? combined.slice(-s.maxPoints)
            : combined
        }
      }
      return { channels: updated }
    })
  },
  togglePause: () => set(s => ({ paused: !s.paused })),
  setTimeWindow: seconds => set({ timeWindow: seconds }),
  clear: () => set({ channels: {} }),
}))
