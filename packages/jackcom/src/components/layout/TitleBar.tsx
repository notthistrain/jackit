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
import { titleBar } from './title-bar.variants'

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
        { labelKey: 'menu.tools.export', disabled: !activePortId, onClick: () => activePortId && exportCurrentSession() },
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
        { labelKey: 'menu.help.about', onClick: () => open('https://github.com/notthistrain/jackit/tree/main/packages/jackcom/README.md') },
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

  const { root, brand, brandIcon, brandText, menuArea, menuContainer, menuTrigger, dragRegion } = titleBar()

  return (
    <div className={root()}>
      <div
        className={brand()}
      >
        <span className={brandIcon()}>&#x26A1;</span>
        <span className={brandText()}>
          {t('app.title')}
        </span>
      </div>

      <div className={menuArea()}>
        {menus.map(menu => (
          <div
            key={menu.id}
            className={menuContainer()}
          >
            <div
              role="menubar"
              data-open={openMenuId === menu.id}
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => handleMenuHover(menu.id)}
              className={menuTrigger()}
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

      <div data-tauri-drag-region className={dragRegion()} />
      <WindowControls />
    </div>
  )
}
