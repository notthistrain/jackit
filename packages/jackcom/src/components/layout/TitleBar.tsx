import { useCallback, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open } from '@tauri-apps/plugin-shell'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { useSerialPort } from '@/hooks/useSerialPort'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { MenuDropdown } from '@/components/menu/MenuDropdown'
import { MenuItem } from '@/components/menu/MenuItem'
import { WindowControls } from './WindowControls'

interface TitleBarProps {
  onOpenConnectionDialog: () => void
  onClearTerminal: () => void
}

interface MenuDef {
  id: string
  items: Array<{
    labelKey?: string
    shortcut?: string
    onClick?: () => void
    disabled?: boolean
    type?: 'item' | 'separator'
  }>
}

export function TitleBar({ onOpenConnectionDialog, onClearTerminal }: TitleBarProps) {
  const { t } = useT()
  const { activePortId, toggleSidebar, toggleHexDisplay, setSidebarTab, toggleConnectionDialog } = useMainStore()
  const { close, closeAll } = useSerialPort()

  const exportCurrentSession = async () => {
    try {
      const filePath = await save({
        defaultPath: 'jackcom-export.csv',
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'HEX', extensions: ['txt'] },
        ],
      })
      if (!filePath) return
      const ext = filePath.split('.').pop()?.toLowerCase()
      const format = ext === 'json' ? 'json' : ext === 'txt' ? 'hex' : 'csv'
      await invoke('export_data', { request: { session_id: null, format, file_path: filePath } })
    } catch {
      // 用户取消或导出失败
    }
  }

  const menus: MenuDef[] = [
    {
      id: 'file',
      items: [
        { labelKey: 'menu.file.newConnection', shortcut: 'Ctrl+N', onClick: onOpenConnectionDialog },
        { labelKey: 'menu.file.openHistory', shortcut: 'Ctrl+O', onClick: () => openHistoryWindow() },
        { labelKey: 'menu.file.export', onClick: () => activePortId && exportCurrentSession() },
        { type: 'separator' },
        { labelKey: 'menu.file.exit', shortcut: 'Ctrl+Q', onClick: () => getCurrentWindow().close() },
      ],
    },
    {
      id: 'connection',
      items: [
        { labelKey: 'menu.connection.connect', onClick: onOpenConnectionDialog },
        { labelKey: 'menu.connection.disconnect', disabled: !activePortId, onClick: () => activePortId && close(activePortId).catch(() => {}) },
        { type: 'separator' },
        { labelKey: 'menu.connection.portSettings', onClick: () => toggleConnectionDialog(true) },
        { type: 'separator' },
        { labelKey: 'menu.connection.close', shortcut: 'Ctrl+W', disabled: !activePortId, onClick: () => activePortId && close(activePortId).catch(() => {}) },
        { labelKey: 'menu.connection.closeAll', onClick: () => closeAll().catch(() => {}) },
      ],
    },
    {
      id: 'view',
      items: [
        { labelKey: 'menu.view.toggleSidebar', onClick: toggleSidebar },
        { labelKey: 'menu.view.toggleHex', shortcut: 'Ctrl+H', onClick: toggleHexDisplay },
        { type: 'separator' },
        { labelKey: 'menu.view.waveform', shortcut: 'Ctrl+Shift+W', onClick: () => activePortId && openWaveformWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.view.decoder', shortcut: 'Ctrl+Shift+D', onClick: () => activePortId && openDecoderWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.view.history', shortcut: 'Ctrl+Shift+H', onClick: () => openHistoryWindow() },
      ],
    },
    {
      id: 'tools',
      items: [
        { labelKey: 'menu.tools.quickSend', onClick: () => { setSidebarTab('snippets'); if (!useMainStore.getState().sidebarVisible) toggleSidebar() } },
        { labelKey: 'menu.tools.clearTerminal', shortcut: 'Ctrl+L', onClick: onClearTerminal },
        { labelKey: 'menu.tools.export', onClick: () => activePortId && exportCurrentSession() },
      ],
    },
    {
      id: 'window',
      items: [
        { labelKey: 'menu.window.waveform', shortcut: 'Ctrl+Shift+W', onClick: () => activePortId && openWaveformWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.window.decoder', shortcut: 'Ctrl+Shift+D', onClick: () => activePortId && openDecoderWindow(activePortId), disabled: !activePortId },
        { labelKey: 'menu.window.history', shortcut: 'Ctrl+Shift+H', onClick: () => openHistoryWindow() },
        { type: 'separator' },
      ],
    },
    {
      id: 'help',
      items: [
        { labelKey: 'menu.help.about', onClick: () => open('https://github.com/nicepkg/jackcom#readme') },
      ],
    },
  ]

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleMenuClick = useCallback((menuId: string) => {
    setOpenMenuId(prev => (prev === menuId ? null : menuId))
  }, [])

  const handleMenuHover = useCallback((menuId: string) => {
    if (openMenuId !== null)
      setOpenMenuId(menuId)
  }, [openMenuId])

  const handleClose = useCallback(() => {
    setOpenMenuId(null)
  }, [])

  return (
    <div style={{
      height: '30px',
      background: 'var(--color-titlebar-bg)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      fontSize: '13px',
      userSelect: 'none',
    }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 10px',
          height: '100%',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--color-accent)', fontSize: '14px' }}>&#x26A1;</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
          {t('app.title')}
        </span>
      </div>

      <div style={{ display: 'flex', height: '100%', flex: 1 }}>
        {menus.map(menu => (
          <div
            key={menu.id}
            style={{ position: 'relative', height: '100%' }}
          >
            <div
              role="menubar"
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => handleMenuHover(menu.id)}
              style={{
                padding: '0 10px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                color: openMenuId === menu.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                background: openMenuId === menu.id ? 'var(--color-menu-bg)' : 'transparent',
                borderRadius: '3px 3px 0 0',
              }}
            >
              {t(`menu.${menu.id}.label`)}
            </div>
            {openMenuId === menu.id && (
              <MenuDropdown onClose={handleClose}>
                {menu.items.map((item, i) => (
                  <MenuItem
                    key={item.labelKey ?? `sep-${i}`}
                    label={item.labelKey ? t(item.labelKey) : undefined}
                    shortcut={item.shortcut}
                    onClick={item.onClick ? () => { item.onClick!(); handleClose() } : undefined}
                    disabled={item.disabled}
                    type={item.type}
                  />
                ))}
              </MenuDropdown>
            )}
          </div>
        ))}
      </div>

      <WindowControls />
    </div>
  )
}
