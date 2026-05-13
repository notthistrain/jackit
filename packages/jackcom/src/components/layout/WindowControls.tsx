import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const currentWin = getCurrentWindow()
    const unlisten = currentWin.onResized(() => {
      currentWin.isMaximized().then(setMaximized)
    })
    currentWin.isMaximized().then(setMaximized)
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize()
  }, [])

  const handleToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize()
  }, [])

  const handleClose = useCallback(() => {
    getCurrentWindow().close()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <WindowButton
        onClick={handleMinimize}
        hoverBg="var(--color-border)"
        title="Minimize"
      >
        ▾
      </WindowButton>
      <WindowButton
        onClick={handleToggleMaximize}
        hoverBg="var(--color-border)"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? '⧉' : '□'}
      </WindowButton>
      <WindowButton
        onClick={handleClose}
        hoverBg="#e81123"
        title="Close"
      >
        ✕
      </WindowButton>
    </div>
  )
}

function WindowButton({
  onClick,
  hoverBg,
  title,
  children,
}: {
  onClick: () => void
  hoverBg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      role="button"
      title={title}
      onClick={onClick}
      style={{
        width: '46px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text)',
        fontSize: '12px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}
