import type { ReactNode } from 'react'
import { button } from './button.variants'

export interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  variant,
  size,
  disabled,
  children,
  onClick,
  type = 'button',
  className,
}: ButtonProps) {
  const { root } = button({ variant, size })

  return (
    <button
      type={type}
      className={root({ className })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
