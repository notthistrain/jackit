const MENU_ITEMS = ['File', 'Connection', 'View', 'Tools', 'Window', 'Help'] as const

export function MenuBar() {
  return (
    <div style={{
      background: 'var(--color-menu-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '2px 8px',
      display: 'flex',
      gap: 0,
      fontSize: '13px',
    }}>
      {MENU_ITEMS.map((item) => (
        <div
          key={item}
          style={{
            color: 'var(--color-text)',
            padding: '3px 10px',
            cursor: 'pointer',
            borderRadius: '3px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-border)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
