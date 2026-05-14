import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { menuDropdown } from './menu-dropdown.variants'

interface MenuDropdownProps {
  children: ReactNode
  onClose: () => void
}

export function MenuDropdown({ children, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { root } = menuDropdown()

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
      className={root()}
    >
      {children}
    </div>
  )
}
