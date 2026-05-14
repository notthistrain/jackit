import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { windowControls } from './window-controls.variants'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const currentWin = getCurrentWindow()
    const unlisten = currentWin.onResized(() => {
      currentWin.isMaximized().then(setMaximized).catch(() => {})
    })
    currentWin.isMaximized().then(setMaximized).catch(() => {})
    return () => { unlisten.then(fn => fn()).catch(() => {}) }
  }, [])

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize().catch(() => {})
  }, [])

  const handleToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize().catch(() => {})
  }, [])

  const handleClose = useCallback(() => {
    getCurrentWindow().close().catch(() => {})
  }, [])

  const { root, btn } = windowControls()

  return (
    <div className={root()}>
      <WindowButton
        onClick={handleMinimize}
        hoverBg="var(--color-border)"
        title="Minimize"
        btn={btn}
      >
        <MinimizeIcon />
      </WindowButton>
      <WindowButton
        onClick={handleToggleMaximize}
        hoverBg="var(--color-border)"
        title={maximized ? 'Restore' : 'Maximize'}
        btn={btn}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </WindowButton>
      <WindowButton
        onClick={handleClose}
        hoverBg="#e81123"
        title="Close"
        btn={btn}
      >
        <CloseIcon />
      </WindowButton>
    </div>
  )
}

/* SVG icons matching VS Code / Windows 11 Fluent style */

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 5H9" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="3" y="0.5" width="6.5" height="6.5" stroke="currentColor" strokeWidth="1" />
      <path d="M3 3H1V9.5H7.5V7.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function WindowButton({
  onClick,
  hoverBg,
  title,
  children,
  btn,
}: {
  onClick: () => void
  hoverBg: string
  title: string
  children: React.ReactNode
  btn: () => string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      role="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={btn()}
      style={{
        color: hovered && hoverBg === '#e81123' ? '#fff' : 'var(--color-text)',
        background: hovered ? hoverBg : 'transparent',
      }}
    >
      {children}
    </div>
  )
}
