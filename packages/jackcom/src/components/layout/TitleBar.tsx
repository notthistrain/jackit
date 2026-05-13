import { useCallback, useState } from 'react'
import { useT } from '@/i18n'
import { useMainStore } from '@/lib/store'
import { openDecoderWindow, openHistoryWindow, openWaveformWindow } from '@/lib/window'
import { MenuDropdown } from '@/components/menu/MenuDropdown'
import { MenuItem } from '@/components/menu/MenuItem'
import { WindowControls } from './WindowControls'

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

export function TitleBar() {
  const { t } = useT()
  const { activePortId, toggleSidebar, toggleHexDisplay } = useMainStore()

  const menus: MenuDef[] = [
    {
      id: 'file',
      items: [
        { labelKey: 'menu.file.newConnection', shortcut: 'Ctrl+N' },
        { labelKey: 'menu.file.openHistory', shortcut: 'Ctrl+O', onClick: () => openHistoryWindow() },
        { labelKey: 'menu.file.export' },
        { type: 'separator' },
        { labelKey: 'menu.file.exit', shortcut: 'Ctrl+Q', onClick: () => window.close() },
      ],
    },
    {
      id: 'connection',
      items: [
        { labelKey: 'menu.connection.connect' },
        { labelKey: 'menu.connection.disconnect', disabled: !activePortId },
        { type: 'separator' },
        { labelKey: 'menu.connection.portSettings' },
        { type: 'separator' },
        { labelKey: 'menu.connection.close', shortcut: 'Ctrl+W', disabled: !activePortId },
        { labelKey: 'menu.connection.closeAll' },
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
        { labelKey: 'menu.tools.quickSend' },
        { labelKey: 'menu.tools.clearTerminal', shortcut: 'Ctrl+L' },
        { labelKey: 'menu.tools.export' },
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
        { labelKey: 'menu.help.about' },
        { labelKey: 'menu.help.documentation' },
        { labelKey: 'menu.help.checkUpdates' },
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
