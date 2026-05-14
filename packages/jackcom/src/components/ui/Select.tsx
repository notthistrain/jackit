import { useState, useRef, useEffect, useCallback } from 'react'
import { select } from './select.variants'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  size?: 'default' | 'compact'
  className?: string
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  size = 'default',
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)
  const displayText = selectedOption?.label ?? placeholder ?? ''

  const enabledOptions = options.filter(o => !o.disabled)

  const close = useCallback(() => {
    setOpen(false)
    setHoveredIndex(-1)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, close])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  const handleTriggerClick = () => {
    if (disabled) return
    setOpen(prev => !prev)
    setHoveredIndex(-1)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setHoveredIndex(-1)
        return
      }
      if (e.key === 'ArrowDown') {
        setHoveredIndex(prev => {
          const next = prev + 1
          return next >= enabledOptions.length ? 0 : next
        })
      } else if (e.key === 'ArrowUp') {
        setHoveredIndex(prev => {
          const next = prev - 1
          return next < 0 ? enabledOptions.length - 1 : next
        })
      } else if ((e.key === 'Enter' || e.key === ' ') && hoveredIndex >= 0) {
        const opt = enabledOptions[hoveredIndex]
        if (opt && !opt.disabled) {
          onChange(opt.value)
          close()
        }
      }
    }
  }

  const handleOptionClick = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    close()
  }

  const handleOptionMouseEnter = (index: number) => {
    setHoveredIndex(index)
  }

  const { root, trigger, arrow, panel, option } = select({
    size,
    open: open || undefined,
    triggerDisabled: disabled || undefined,
  })

  // 找到当前 hoveredIndex 对应的 enabled option
  const hoveredValue = hoveredIndex >= 0 && hoveredIndex < enabledOptions.length
    ? enabledOptions[hoveredIndex].value
    : null

  return (
    <div ref={rootRef} className={root()}>
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={trigger()}
      >
        <span className={selectedOption ? 'text-text' : 'text-text-secondary'}>
          {displayText}
        </span>
        <ChevronDownIcon className={arrow()} />
      </div>
      {open && (
        <div ref={panelRef} role="listbox" className={panel()}>
          {options.map(opt => {
            const isSelected = opt.value === value
            const isHovered = opt.value === hoveredValue
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleOptionClick(opt)}
                onMouseEnter={() => {
                  if (!opt.disabled) {
                    const idx = enabledOptions.indexOf(opt)
                    if (idx >= 0) handleOptionMouseEnter(idx)
                  }
                }}
                className={option({
                  selected: isSelected,
                  hovered: isHovered,
                  disabled: opt.disabled,
                })}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ className }: { className: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
