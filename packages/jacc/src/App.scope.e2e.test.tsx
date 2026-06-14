import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { LocaleProvider } from './i18n'
import { useAppStore } from './stores/useAppStore'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    show: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}))

const layerCalls: Array<{ scope: string, projectPath: string | null }> = []
const writeCalls: Array<{ key: string, sensitive: boolean, scope: string }> = []

afterEach(() => {
  clearMocks()
  layerCalls.length = 0
  writeCalls.length = 0
  useAppStore.setState({ configScope: 'global', currentProject: null, currentPage: 'general' })
})

function setupMockIPC() {
  mockIPC((cmd: string, payload: any) => {
    switch (cmd) {
      case 'read_config_layer':
        layerCalls.push({ scope: payload.scope, projectPath: payload.projectPath ?? null })
        return { items: [] }
      case 'read_merged_config':
        return { items: [] }
      case 'get_slot_bindings':
        return []
      case 'list_projects':
        return []
      case 'get_preference':
      case 'set_preference':
      case 'set_active_project':
        return null
      case 'write_config':
        writeCalls.push({ key: payload.key, sensitive: payload.sensitive, scope: payload.scope })
        return { wrote_local: payload.sensitive === true, gitignore_updated: payload.sensitive === true }
      default:
        return null
    }
  })
}

describe('scope switch e2e', () => {
  it('global scope 挂载时按 global 调 read_config_layer，切 project 无项目时守卫', async () => {
    setupMockIPC()
    render(
      <LocaleProvider>
        <App />
      </LocaleProvider>,
    )
    // General 页加载完成（global scope 读 layer）
    await waitFor(() => expect(screen.getByText('通用设置')).toBeTruthy())
    expect(layerCalls.some(c => c.scope === 'global')).toBe(true)

    // 切到项目 scope 但无项目 → 守卫渲染 EmptyState
    useAppStore.setState({ configScope: 'project' })
    await waitFor(() => expect(screen.getByText('还没有打开项目')).toBeTruthy())
  })
})
