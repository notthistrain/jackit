import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { input } from './input.variants'

export interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  type?: 'text' | 'password' | 'email' | 'number'
  togglePassword?: boolean
  className?: string
}

export function Input({
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled,
  size,
  type = 'text',
  togglePassword = false,
  className,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const hasTrailing = type === 'password' && togglePassword
  const effectiveType = hasTrailing && showPassword ? 'text' : type

  const { root, label: labelClass, wrapper, trailingButton, error: errorClass } = input({
    size,
    hasError: !!error,
    hasTrailing,
    disabled,
  })

  return (
    <div className={className}>
      {label && <label className={labelClass()}>{label}</label>}
      <div className={wrapper()}>
        <input
          type={effectiveType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={root()}
        />
        {hasTrailing && (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className={trailingButton()}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <div className={errorClass()}>{error}</div>}
    </div>
  )
}
