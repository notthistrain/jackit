import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { LocaleProvider } from './i18n'
import { useAppStore } from './stores/useAppStore'

// 真实窗口控制 / 文件对话框无法在 jsdom 中工作，mock 边界即可
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    show: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
// 事件插件依赖注入的内部对象在 jsdom 中不可用，stub 掉避免卸载时报错
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}))

interface ConfigItem {
  key: string
  value: unknown
  scope: 'global' | 'project'
}

let mockConfig: { items: ConfigItem[] } = { items: [] }
const writeConfigCalls: Array<{ key: string, value: unknown, scope: string }> = []

function setupMockIPC() {
  mockIPC((cmd: string, payload: any) => {
    switch (cmd) {
      case 'get_preference':
        return null
      case 'set_preference':
        return null
      case 'read_merged_config':
        return mockConfig
      case 'write_config': {
        writeConfigCalls.push({
          key: payload.key,
          value: payload.value,
          scope: payload.scope,
        })
        const idx = mockConfig.items.findIndex(i => i.key === payload.key)
        if (idx >= 0) {
          mockConfig.items[idx] = {
            ...mockConfig.items[idx],
            value: payload.value,
            scope: payload.scope,
          }
        }
        else {
          mockConfig.items.push({
            key: payload.key,
            value: payload.value,
            scope: payload.scope,
          })
        }
        return null
      }
      case 'delete_config':
        return null
      case 'set_active_project':
        return null
      case 'get_slot_bindings':
        return []
      case 'list_projects':
        return []
      case 'list_providers':
        return []
      case 'list_api_keys':
        return []
      case 'list_models':
        return []
      case 'list_skills':
        return []
      default:
        return null
    }
  })
}

beforeEach(() => {
  // 重置 store 到初始态
  useAppStore.setState({
    currentPage: 'general',
    currentProject: null,
    theme: 'system',
  })
  mockConfig = { items: [] }
  writeConfigCalls.length = 0
  document.documentElement.removeAttribute('data-theme')
  setupMockIPC()
})

afterEach(() => {
  clearMocks()
  vi.clearAllMocks()
})

function renderApp() {
  return render(
    <LocaleProvider>
      <App />
    </LocaleProvider>,
  )
}

describe('app e2e', () => {
  it('启动后渲染侧边栏导航并完成 General 页面加载', async () => {
    renderApp()
    // 侧边栏导航项（zh 文案）；用 role=button 缩窄到 Sidebar 中的 navItem
    expect(
      await screen.findByRole('button', { name: /通用/ }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /环境变量/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /模型库/ })).toBeTruthy()
    // General 页面加载完成（loading 文案消失）
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).toBeNull()
    })
    // General 标题渲染
    expect(screen.getByText('通用设置')).toBeTruthy()
  })

  it('点击侧边栏权限项切换到 Permissions 页面', async () => {
    renderApp()
    const user = userEvent.setup()
    const permissionsNav = await screen.findByRole('button', { name: /权限/ })
    await user.click(permissionsNav)
    await waitFor(() => {
      expect(useAppStore.getState().currentPage).toBe('permissions')
    })
  })

  it('点击 Skills 但未选项目时进入 skills 页面（呈现 EmptyState）', async () => {
    renderApp()
    const user = userEvent.setup()
    const skillsNav = await screen.findByRole('button', { name: /^Skills$/ })
    await user.click(skillsNav)
    await waitFor(() => {
      expect(useAppStore.getState().currentPage).toBe('skills')
    })
    // 未选项目时 Layout 渲染 EmptyState（其特征文案）
    expect(screen.getByText('还没有打开项目')).toBeTruthy()
  })
})
