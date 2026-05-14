import { menuItem } from './menu-item.variants'

interface MenuItemProps {
  label?: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'item' | 'separator'
}

export function MenuItem({
  label,
  shortcut,
  onClick,
  disabled = false,
  type = 'item',
}: MenuItemProps) {
  const { separator, item, label: labelCls, shortcut: shortcutCls } = menuItem()

  if (type === 'separator') {
    return (
      <div className={separator()} />
    )
  }

  return (
    <div
      role="menuitem"
      data-disabled={disabled}
      className={item()}
      onClick={() => {
        if (!disabled && onClick)
          onClick()
      }}
    >
      <span className={labelCls()}>{label}</span>
      {shortcut && (
        <span className={shortcutCls()}>
          {shortcut}
        </span>
      )}
    </div>
  )
}
