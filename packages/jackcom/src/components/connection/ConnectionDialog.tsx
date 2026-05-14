import { useState, useCallback, useRef, useEffect } from 'react'
import { useT } from '@/i18n'
import { useSerialConfig } from '@/hooks/useSerialConfig'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useMainStore } from '@/lib/store'
import { SerialConfigForm } from './SerialConfigForm'

interface ConnectionDialogProps {
  onClose: () => void
}

export function ConnectionDialog({ onClose }: ConnectionDialogProps) {
  const { t } = useT()
  const { config, setConfig, recentConfigs, saveAsRecent } = useSerialConfig()
  const { open } = useSerialPort()
  const { toggleConnectionDialog } = useMainStore()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRecent, setHoveredRecent] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleConnect = useCallback(async (overrideConfig?: typeof config) => {
    const cfg = overrideConfig ?? config
    if (!cfg.portName) {
      setError('Please select a port')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      await open({
        port_name: cfg.portName,
        baud_rate: cfg.baudRate,
        data_bits: dataBitsToString(cfg.dataBits),
        stop_bits: stopBitsToString(cfg.stopBits),
        parity: cfg.parity,
        flow_control: cfg.flowControl,
      })
      saveAsRecent()
      toggleConnectionDialog(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConnecting(false)
    }
  }, [config, open, saveAsRecent, toggleConnectionDialog, onClose])

  const handleRecentSelect = useCallback((recent: typeof config) => {
    setConfig({
      portName: recent.portName,
      baudRate: recent.baudRate,
      dataBits: recent.dataBits,
      stopBits: recent.stopBits,
      parity: recent.parity,
      flowControl: recent.flowControl,
    })
  }, [setConfig])

  const handleClose = useCallback(() => {
    toggleConnectionDialog(false)
    onClose()
  }, [toggleConnectionDialog, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      handleClose()
    }
  }, [handleClose])

  const handleRecentConnect = useCallback((recent: typeof config) => {
    handleConnect(recent)
  }, [handleConnect])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={t('connection.title')}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          background: '#1e1e1e',
          borderRadius: '6px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          minWidth: '480px',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: '11px',
          color: '#d4d4d4',
        }}
      >
        {/* Title bar */}
        <div style={{
          background: '#323233',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #3c3c3c',
        }}
        >
          <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '12px' }}>
            {t('connection.title')}
          </span>
          <button
            onClick={handleClose}
            style={{
              marginLeft: 'auto',
              color: '#858585',
              cursor: 'pointer',
              fontSize: '14px',
              background: 'transparent',
              border: 'none',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', minHeight: '200px' }}>
          {/* Left: Recent connections */}
          {recentConfigs.length > 0 && (
            <div style={{
              width: '160px',
              borderRight: '1px solid #3c3c3c',
              padding: '10px',
            }}
            >
              <div style={{
                color: '#858585',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
              >
                RECENT
              </div>
              {recentConfigs.map((rc, i) => (
                <div
                  key={`${rc.portName}-${rc.baudRate}-${i}`}
                  onClick={() => handleRecentConnect(rc)}
                  onMouseEnter={() => setHoveredRecent(i)}
                  onMouseLeave={() => setHoveredRecent(null)}
                  style={{
                    background: hoveredRecent === i ? 'var(--color-accent)' : '#2a2d2e',
                    borderRadius: '3px',
                    padding: '6px 8px',
                    marginBottom: '3px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#d4d4d4', fontSize: '11px', fontWeight: 600 }}>
                    {rc.portName}
                  </div>
                  <div style={{ color: '#858585', fontSize: '10px' }}>
                    {rc.baudRate.toLocaleString()} {rc.dataBits}{rc.parity[0].toUpperCase()}{rc.stopBits}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Right: Config form + buttons */}
          <div style={{
            flex: 1,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
          >
            <SerialConfigForm config={config} onChange={setConfig} />

            {/* Error */}
            {error && (
              <div style={{
                fontSize: '11px',
                color: '#e06c75',
                padding: '4px 8px',
                background: 'rgba(224, 108, 117, 0.1)',
                borderRadius: '3px',
              }}
              >
                {error}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={handleClose}
                style={{
                  background: 'transparent',
                  border: '1px solid #4c4c4c',
                  borderRadius: '3px',
                  padding: '4px 14px',
                  color: '#858585',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleConnect()}
                disabled={connecting || !config.portName}
                style={{
                  background: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 14px',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: connecting || !config.portName ? 'not-allowed' : 'pointer',
                  opacity: connecting || !config.portName ? 0.6 : 1,
                }}
              >
                {connecting ? t('connection.connecting') : t('connection.connect')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function dataBitsToString(bits: number): string {
  switch (bits) {
    case 5: return 'five'
    case 6: return 'six'
    case 7: return 'seven'
    case 8: return 'eight'
    default: return 'eight'
  }
}

function stopBitsToString(bits: number): string {
  switch (bits) {
    case 1: return 'one'
    case 2: return 'two'
    default: return 'one'
  }
}
