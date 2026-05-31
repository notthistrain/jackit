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
  className,
}: InputProps) {
  const { root, label: labelClass, error: errorClass } = input({
    size,
    hasError: !!error,
    disabled,
  })

  return (
    <div className={className}>
      {label && <label className={labelClass()}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={root()}
      />
      {error && <div className={errorClass()}>{error}</div>}
    </div>
  )
}
