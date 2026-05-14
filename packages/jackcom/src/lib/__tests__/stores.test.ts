import { describe, expect, it } from 'vitest'
import { useMainStore } from '@/lib/store'
import { useDecoderStore } from '@/stores/decoder-store'
import { useWaveformStore } from '@/stores/waveform-store'

describe('useMainStore', () => {
  it('toggles sidebar visibility', () => {
    const store = useMainStore.getState()
    const initial = store.sidebarVisible
    store.toggleSidebar()
    expect(useMainStore.getState().sidebarVisible).toBe(!initial)
    store.toggleSidebar()
    expect(useMainStore.getState().sidebarVisible).toBe(initial)
  })

  it('switches sidebar tab', () => {
    useMainStore.getState().setSidebarTab('snippets')
    expect(useMainStore.getState().sidebarTab).toBe('snippets')
    useMainStore.getState().setSidebarTab('connections')
    expect(useMainStore.getState().sidebarTab).toBe('connections')
  })

  it('sets active port', () => {
    useMainStore.getState().setActivePortId('COM3')
    expect(useMainStore.getState().activePortId).toBe('COM3')
    useMainStore.getState().setActivePortId(null)
    expect(useMainStore.getState().activePortId).toBeNull()
  })

  it('adds and removes connections', () => {
    useMainStore.getState().addConnection('COM3', 115200)
    const state = useMainStore.getState()
    expect(state.connections.COM3).toEqual({ portName: 'COM3', baudRate: 115200, online: true })
    // Adding first connection auto-sets activePortId
    expect(state.activePortId).toBe('COM3')

    useMainStore.getState().removeConnection('COM3')
    expect(useMainStore.getState().connections.COM3).toBeUndefined()
    expect(useMainStore.getState().activePortId).toBeNull()
  })

  it('falls back activePortId when removing active connection', () => {
    useMainStore.getState().addConnection('COM1', 9600)
    useMainStore.getState().addConnection('COM2', 115200)
    useMainStore.getState().setActivePortId('COM1')
    useMainStore.getState().removeConnection('COM1')
    // Should fall back to remaining connection
    expect(useMainStore.getState().activePortId).toBe('COM2')
    // Cleanup
    useMainStore.getState().removeConnection('COM2')
  })

  it('sets connection online status', () => {
    useMainStore.getState().addConnection('COM5', 9600)
    useMainStore.getState().setConnectionOnline('COM5', false)
    expect(useMainStore.getState().connections.COM5.online).toBe(false)
    useMainStore.getState().removeConnection('COM5')
  })

  it('updates stats', () => {
    useMainStore.getState().updateStats('COM3', 1024, 512)
    expect(useMainStore.getState().stats.COM3).toEqual({ rx: 1024, tx: 512 })
  })

  it('toggles hex display', () => {
    const initial = useMainStore.getState().hexDisplay
    useMainStore.getState().toggleHexDisplay()
    expect(useMainStore.getState().hexDisplay).toBe(!initial)
    useMainStore.getState().toggleHexDisplay()
  })

  it('increments clearSequence', () => {
    const initial = useMainStore.getState().clearSequence
    useMainStore.getState().incrementClearSequence()
    expect(useMainStore.getState().clearSequence).toBe(initial + 1)
  })

  it('toggles connection dialog', () => {
    expect(useMainStore.getState().connectionDialogOpen).toBe(false)
    useMainStore.getState().toggleConnectionDialog(true)
    expect(useMainStore.getState().connectionDialogOpen).toBe(true)
    useMainStore.getState().toggleConnectionDialog(false)
    expect(useMainStore.getState().connectionDialogOpen).toBe(false)
  })
})

describe('useWaveformStore', () => {
  it('sets port ID', () => {
    useWaveformStore.getState().setPortId('COM3')
    expect(useWaveformStore.getState().portId).toBe('COM3')
    // Reset
    useWaveformStore.getState().setPortId(null as any)
  })

  it('adds data to channels', () => {
    useWaveformStore.getState().addData('temperature', 25.5)
    useWaveformStore.getState().addData('temperature', 26.0)
    const channel = useWaveformStore.getState().channels.temperature
    expect(channel).toHaveLength(2)
    expect(channel![0]).toBe(25.5)
    expect(channel![1]).toBe(26.0)
    useWaveformStore.getState().clear()
  })

  it('respects maxPoints limit', () => {
    const store = useWaveformStore.getState()
    for (let i = 0; i < 600; i++) {
      store.addData('ch1', i)
    }
    const channel = useWaveformStore.getState().channels.ch1
    // maxPoints is 500
    expect(channel!.length).toBe(500)
    // Should keep latest values
    expect(channel![0]).toBe(100) // first retained = 600 - 500
    expect(channel![499]).toBe(599) // last = newest
    useWaveformStore.getState().clear()
  })

  it('toggles pause', () => {
    const initial = useWaveformStore.getState().paused
    useWaveformStore.getState().togglePause()
    expect(useWaveformStore.getState().paused).toBe(!initial)
    useWaveformStore.getState().togglePause()
  })

  it('clears all channels', () => {
    useWaveformStore.getState().addData('ch1', 1)
    useWaveformStore.getState().addData('ch2', 2)
    useWaveformStore.getState().clear()
    expect(Object.keys(useWaveformStore.getState().channels)).toHaveLength(0)
  })
})

describe('useDecoderStore', () => {
  const testFrame = {
    id: 1,
    timestamp: '2025-01-15T10:30:00Z',
    direction: 'rx' as const,
    raw_hex: '01 03',
    formatted: 'test',
    protocol: 'raw',
    summary: '2 bytes',
  }

  it('sets port ID', () => {
    useDecoderStore.getState().setPortId('COM3')
    expect(useDecoderStore.getState().portId).toBe('COM3')
  })

  it('pins and unpins frames', () => {
    expect(useDecoderStore.getState().pinnedFrame).toBeNull()
    useDecoderStore.getState().pinFrame(testFrame)
    expect(useDecoderStore.getState().pinnedFrame).toEqual(testFrame)
    useDecoderStore.getState().pinFrame(null)
    expect(useDecoderStore.getState().pinnedFrame).toBeNull()
  })

  it('sets auto scroll', () => {
    useDecoderStore.getState().setAutoScroll(false)
    expect(useDecoderStore.getState().autoScroll).toBe(false)
    useDecoderStore.getState().setAutoScroll(true)
    expect(useDecoderStore.getState().autoScroll).toBe(true)
  })
})
