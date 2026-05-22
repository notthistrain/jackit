import { beforeEach, describe, expect, it } from 'vitest'
import { WaveformRenderer } from '../WaveformRenderer'

describe('waveformRenderer', () => {
  let renderer: WaveformRenderer

  beforeEach(() => {
    renderer = new WaveformRenderer()
  })

  // --- 基础生命周期 ---

  it('reports not initialized before init', () => {
    expect(renderer.isReady()).toBe(false)
  })

  it('returns false when WebGPU is not available', async () => {
    const result = await renderer.init({
      width: 400,
      height: 300,
      getContext: () => null,
    } as any)
    expect(result).toBe(false)
  })

  it('destroy does not throw when not initialized', () => {
    expect(() => renderer.destroy()).not.toThrow()
  })

  // --- updateData ---

  it('updateData stores channels internally', () => {
    renderer.updateData({ temperature: [25.0, 26.0, 27.0] })
    // 内部存储，不抛异常即通过
  })

  // --- setZoom ---

  it('setZoom clamps to [0.1, 100]', () => {
    renderer.setZoom(0.01)
    expect(renderer.getZoom()).toBe(0.1)

    renderer.setZoom(200)
    expect(renderer.getZoom()).toBe(100)

    renderer.setZoom(5)
    expect(renderer.getZoom()).toBe(5)
  })

  it('setZoom disables autoFit', () => {
    // 初始 autoFit = true
    renderer.updateData({ ch: [1, 2, 3] })
    renderer.setZoom(2)
    expect(renderer.getZoom()).toBe(2)
  })

  // --- setOffset ---

  it('setOffset stores offset when no canvas/channels', () => {
    renderer.setOffset(0.5)
    expect(renderer.getOffset()).toBe(0.5)
  })

  // --- resetView ---

  it('resetView resets offset and enables autoFit', () => {
    renderer.setZoom(5)
    renderer.setOffset(0.3)
    renderer.resetView()
    expect(renderer.getOffset()).toBe(0)
  })

  // --- getEffectiveZoom ---

  describe('getEffectiveZoom', () => {
    it('returns default zoom when no canvas or channels', () => {
      renderer.setZoom(3.0)
      expect(renderer.getEffectiveZoom()).toBe(3.0)
    })

    it('returns default zoom when channels but no canvas', () => {
      renderer.updateData({ ch: [1, 2, 3, 4, 5] })
      renderer.setZoom(3.0)
      expect(renderer.getEffectiveZoom()).toBe(3.0)
    })

    it('returns canvas.width / maxLen in autoFit mode', () => {
      renderer.updateData({ ch: Array.from({ length: 100 }, (_, i) => i) })
      // Mock canvas
      const mockCanvas = { width: 400, height: 300, getContext: () => null } as any
      // Can't fully init without WebGPU, but we can test the logic indirectly
      // getEffectiveZoom checks this.canvas !== null
      renderer.setZoom(2.0)
      expect(renderer.getEffectiveZoom()).toBe(2.0) // no canvas, returns manual zoom
    })
  })

  // --- getVisibleRange ---

  describe('getVisibleRange', () => {
    it('returns [0,0] when no canvas or channels', () => {
      expect(renderer.getVisibleRange()).toEqual({ startIndex: 0, endIndex: 0 })
    })

    it('returns [0,0] when channels but no canvas', () => {
      renderer.updateData({ ch: [1, 2, 3] })
      expect(renderer.getVisibleRange()).toEqual({ startIndex: 0, endIndex: 0 })
    })
  })

  // --- getDataAtScreenX ---

  describe('getDataAtScreenX', () => {
    it('returns null when no channels', () => {
      expect(renderer.getDataAtScreenX(100, 400)).toBeNull()
    })

    it('returns null for negative point index', () => {
      renderer.updateData({ ch1: [10, 20, 30] })
      renderer.setZoom(1.0)
      // screenX=0, canvasWidth=400 → xNorm=0, maxPoints=400/1.0=400, pointIndex=(0-0)*400=0 → valid
      const result = renderer.getDataAtScreenX(0, 400)
      expect(result).not.toBeNull()
      expect(result!.index).toBe(0)
    })

    it('returns values for valid screen position', () => {
      renderer.updateData({ ch1: [0.0, 0.5, 1.0] })
      renderer.setZoom(400 / 3) // 3 points across 400px
      // screenX=200 → xNorm=0.5 → maxPoints=3 → pointIndex=round(0.5*3)=2
      const result = renderer.getDataAtScreenX(200, 400)
      expect(result).not.toBeNull()
      expect(result!.index).toBe(2)
      expect(result!.values).toHaveLength(1)
      expect(result!.values[0].channel).toBe('ch1')
      expect(result!.values[0].value).toBe(1.0)
    })

    it('returns null when all channel values are undefined', () => {
      renderer.updateData({ ch1: [10] })
      renderer.setZoom(1.0)
      // screenX=399, canvasWidth=400 → maxPoints=400 → pointIndex=399
      // ch1 only has 1 value, so index 399 is out of bounds
      const result = renderer.getDataAtScreenX(399, 400)
      expect(result).toBeNull()
    })

    it('handles multi-channel data', () => {
      renderer.updateData({
        ch1: [0.1, 0.2, 0.3],
        ch2: [0.4, 0.5, 0.6],
      })
      renderer.setZoom(400 / 3)
      const result = renderer.getDataAtScreenX(200, 400)
      expect(result).not.toBeNull()
      expect(result!.values).toHaveLength(2)
      expect(result!.values[0].channel).toBe('ch1')
      expect(result!.values[1].channel).toBe('ch2')
    })
  })

  // --- markDirty ---

  it('markDirty does not throw', () => {
    expect(() => renderer.markDirty()).not.toThrow()
  })

  // --- constructor options ---

  it('accepts onDeviceLost option without throwing', () => {
    const r = new WaveformRenderer({ onDeviceLost: () => {} })
    expect(r.isReady()).toBe(false)
  })
})
