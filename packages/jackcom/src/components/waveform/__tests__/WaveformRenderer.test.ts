import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WaveformRenderer } from '../WaveformRenderer'

describe('WaveformRenderer', () => {
  let renderer: WaveformRenderer

  beforeEach(() => {
    renderer = new WaveformRenderer()
  })

  it('reports not initialized before init', () => {
    expect(renderer.isReady()).toBe(false)
  })

  it('returns false when WebGPU is not available', async () => {
    // navigator.gpu 不存在时 init 返回 false
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

  it('updateData stores channels internally', () => {
    renderer.updateData({ temperature: [25.0, 26.0, 27.0] })
    // 内部存储，不抛异常即通过
  })

  it('setZoom and setOffset do not throw', () => {
    renderer.setZoom(2.0)
    renderer.setOffset(0.5)
  })
})
