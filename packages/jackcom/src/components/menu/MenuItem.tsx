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
  if (type === 'separator') {
    return (
      <div style={{
        height: '1px',
        background: 'var(--color-border)',
        margin: '4px 8px',
      }}
      />
    )
  }

  return (
    <div
      role="menuitem"
      onClick={() => {
        if (!disabled && onClick)
          onClick()
      }}
      style={{
        padding: '4px 24px 4px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text)',
        fontSize: '12px',
        borderRadius: '3px',
        margin: '0 4px',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background = 'var(--color-accent)'
        if (!disabled)
          e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled ? 'var(--color-text-secondary)' : 'var(--color-text)'
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: '11px',
          color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
          marginLeft: 'auto',
        }}
        >
          {shortcut}
        </span>
      )}
    </div>
  )
}
