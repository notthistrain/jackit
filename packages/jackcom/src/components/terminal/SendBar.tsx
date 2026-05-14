import { useCallback, useRef, useState } from 'react'
import { hexToBytes } from '@/lib/formatters'

type SendMode = 'hex' | 'ascii'
type LineEnding = 'none' | 'lf' | 'cr' | 'crlf'

interface SendBarProps {
  onSend: (data: number[]) => void
  disabled?: boolean
}

export function SendBar({ onSend, disabled }: SendBarProps) {
  const [mode, setMode] = useState<SendMode>('hex')
  const [lineEnding, setLineEnding] = useState<LineEnding>('none')
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const lastValidHex = useRef('')

  const handleSend = useCallback(() => {
    if (disabled)
      return

    let bytes: number[] | null = null

    if (mode === 'hex') {
      bytes = hexToBytes(input)
      if (bytes === null) {
        setError(true)
        return
      }
    }
    else {
      // ASCII 模式
      bytes = Array.from(input).map(c => c.charCodeAt(0))
    }

    // 追加行结束符
    switch (lineEnding) {
      case 'lf':
        bytes.push(0x0A)
        break
      case 'cr':
        bytes.push(0x0D)
        break
      case 'crlf':
        bytes.push(0x0D, 0x0A)
        break
    }

    if (bytes.length > 0) {
      onSend(bytes)
    }
  }, [input, mode, lineEnding, disabled, onSend])

  const handleBlur = useCallback(() => {
    if (mode === 'hex') {
      const result = hexToBytes(input)
      if (result === null) {
        // 恢复上一次合法值
        setInput(lastValidHex.current)
        setError(false)
      }
      else {
        lastValidHex.current = input
        setError(false)
      }
    }
  }, [input, mode])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div style={{
      background: 'var(--color-sidebar-bg)',
      borderTop: '1px solid var(--color-border)',
      padding: '6px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}
    >
      {/* 选项行 */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
        <button
          onClick={() => setMode('hex')}
          style={{
            background: mode === 'hex' ? 'var(--color-accent)' : 'transparent',
            color: mode === 'hex' ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '1px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '10px',
          }}
        >
          HEX
        </button>
        <button
          onClick={() => setMode('ascii')}
          style={{
            background: mode === 'ascii' ? 'var(--color-accent)' : 'transparent',
            color: mode === 'ascii' ? '#fff' : 'var(--color-text-secondary)',
            border: 'none',
            padding: '1px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          ASCII
        </button>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        {(['none', 'lf', 'cr', 'crlf'] as LineEnding[]).map(le => (
          <button
            key={le}
            onClick={() => setLineEnding(le)}
            style={{
              background: lineEnding === le ? 'var(--color-border)' : 'transparent',
              color: lineEnding === le ? 'var(--color-text)' : 'var(--color-text-secondary)',
              border: 'none',
              padding: '1px 4px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
          >
            +
            {le.toUpperCase()}
          </button>
        ))}
      </div>
      {/* 输入行 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (mode === 'hex') {
              setError(hexToBytes(e.target.value) === null && e.target.value.length > 0)
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'hex' ? '01 03 00 00 00 0A C5 CD' : 'AT+RST'}
          disabled={disabled}
          style={{
            flex: 1,
            background: 'var(--color-editor-bg)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
            borderRadius: '3px',
            padding: '4px 8px',
            color: 'var(--color-text)',
            fontFamily: '\'Consolas\', monospace',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            padding: '4px 20px',
            borderRadius: '3px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '11px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
