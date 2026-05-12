import { create } from 'zustand'

export type PanelType = 'terminal' | 'table' | 'modbus' | 'atcmd'
export type SidebarTab = 'connections' | 'snippets'

interface MainStore {
  // 侧边栏
  sidebarVisible: boolean
  sidebarTab: SidebarTab
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void

  // 面板
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void

  // 当前活动端口
  activePortId: string | null
  setActivePortId: (id: string | null) => void

  // 连接列表
  connections: Record<string, { portName: string; baudRate: number; online: boolean }>
  addConnection: (portName: string, baudRate: number) => void
  removeConnection: (portName: string) => void
  setConnectionOnline: (portName: string, online: boolean) => void

  // 统计
  stats: Record<string, { rx: number; tx: number }>
  updateStats: (portName: string, rx: number, tx: number) => void

  // Hex 显示模式
  hexDisplay: boolean
  toggleHexDisplay: () => void
}

export const useMainStore = create<MainStore>((set) => ({
  sidebarVisible: true,
  sidebarTab: 'connections',
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  activePanel: 'terminal',
  setActivePanel: (panel) => set({ activePanel: panel }),

  activePortId: null,
  setActivePortId: (id) => set({ activePortId: id }),

  connections: {},
  addConnection: (portName, baudRate) =>
    set((s) => ({
      connections: { ...s.connections, [portName]: { portName, baudRate, online: true } },
      activePortId: s.activePortId ?? portName,
    })),
  removeConnection: (portName) =>
    set((s) => {
      const { [portName]: _, ...rest } = s.connections
      return {
        connections: rest,
        activePortId: s.activePortId === portName
          ? Object.keys(rest)[0] ?? null
          : s.activePortId,
      }
    }),
  setConnectionOnline: (portName, online) =>
    set((s) => ({
      connections: {
        ...s.connections,
        [portName]: { ...s.connections[portName], online },
      },
    })),

  stats: {},
  updateStats: (portName, rx, tx) =>
    set((s) => ({ stats: { ...s.stats, [portName]: { rx, tx } } })),

  hexDisplay: true,
  toggleHexDisplay: () => set((s) => ({ hexDisplay: !s.hexDisplay })),
}))
