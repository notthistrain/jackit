import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface MenuDropdownProps {
  children: ReactNode
  onClose: () => void
}

export function MenuDropdown({ children, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape')
        onClose()
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        background: 'var(--color-menu-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        padding: '4px 0',
        minWidth: '180px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
    >
      {children}
    </div>
  )
}
