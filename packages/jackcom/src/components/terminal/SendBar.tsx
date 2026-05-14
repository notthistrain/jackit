import { useState, useCallback, useRef } from 'react'
import { hexToBytes } from '@/lib/formatters'
import { sendBar } from './send-bar.variants'

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
  const { root, optionsRow, modeBtn, separator, lineEndingBtn, inputRow, input: inputEl, sendBtn } = sendBar()

  const handleSend = useCallback(() => {
    if (disabled) return

    let bytes: number[] | null = null

    if (mode === 'hex') {
      bytes = hexToBytes(input)
      if (bytes === null) {
        setError(true)
        return
      }
    } else {
      // ASCII 模式
      bytes = Array.from(input).map((c) => c.charCodeAt(0))
    }

    // 追加行结束符
    switch (lineEnding) {
      case 'lf':
        bytes.push(0x0a)
        break
      case 'cr':
        bytes.push(0x0d)
        break
      case 'crlf':
        bytes.push(0x0d, 0x0a)
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
      } else {
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
    <div className={root()}>
      {/* 选项行 */}
      <div className={optionsRow()}>
        <button
          onClick={() => setMode('hex')}
          className={modeBtn({ active: mode === 'hex' })}
        >
          HEX
        </button>
        <button
          onClick={() => setMode('ascii')}
          className={modeBtn({ active: mode === 'ascii' })}
        >
          ASCII
        </button>
        <span className={separator()}>|</span>
        {(['none', 'lf', 'cr', 'crlf'] as LineEnding[]).map((le) => (
          <button
            key={le}
            onClick={() => setLineEnding(le)}
            className={lineEndingBtn({ lineEndingActive: lineEnding === le })}
          >
            +{le.toUpperCase()}
          </button>
        ))}
      </div>
      {/* 输入行 */}
      <div className={inputRow()}>
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
          className={inputEl({ error })}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          className={sendBtn({ disabled })}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
