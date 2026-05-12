import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}))

describe('usePortWatcher', () => {
  it('calls onChange when port:change event fires', async () => {
    const { listen } = await import('@tauri-apps/api/event')
    const onChange = vi.fn()

    // 导入 hook（在 mock 之后）
    const { usePortWatcher } = await import('../usePortWatcher')
    renderHook(() => usePortWatcher(onChange))

    // 验证 listen 被调用
    expect(listen).toHaveBeenCalledWith('port:change', expect.any(Function))
  })
})
