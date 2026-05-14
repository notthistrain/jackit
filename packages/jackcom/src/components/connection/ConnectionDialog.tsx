import { useState, useCallback, useRef, useEffect } from 'react'
import { useT } from '@/i18n'
import { useSerialConfig } from '@/hooks/useSerialConfig'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useMainStore } from '@/lib/store'
import { SerialConfigForm } from './SerialConfigForm'

interface ConnectionDialogProps {
  onClose: () => void
}

/**
 * Serial port connection dialog.
 *
 * Renders a modal overlay with a SerialConfigForm, recent-connections list,
 * and connect/cancel buttons. On successful connection, calls the store's
 * addConnection (via useSerialPort) and closes the dialog.
 */
export function ConnectionDialog({ onClose }: ConnectionDialogProps) {
  const { t } = useT()
  const { config, setConfig, recentConfigs, saveAsRecent } = useSerialConfig()
  const { open } = useSerialPort()
  const { toggleConnectionDialog } = useMainStore()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRecent, setHoveredRecent] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Auto-focus dialog for keyboard handling
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleConnect = useCallback(async () => {
    if (!config.portName) {
      setError('Please select a port')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      // Map UI config to Tauri command format
      await open({
        port_name: config.portName,
        baud_rate: config.baudRate,
        data_bits: dataBitsToString(config.dataBits),
        stop_bits: stopBitsToString(config.stopBits),
        parity: config.parity,
        flow_control: config.flowControl,
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      toggleConnectionDialog(false)
      onClose()
    }
  }, [toggleConnectionDialog, onClose])

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
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          toggleConnectionDialog(false)
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={t('connection.title')}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          background: 'var(--color-menu-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          padding: '16px',
          minWidth: '380px',
          maxWidth: '460px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text)',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--color-border)',
        }}
        >
          {t('connection.title')}
        </div>

        {/* Config form */}
        <SerialConfigForm config={config} onChange={setConfig} />

        {/* Recent connections */}
        {recentConfigs.length > 0 && (
          <div>
            <div style={{
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              marginBottom: '4px',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
            >
              {t('connection.recent')}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxHeight: '100px',
              overflowY: 'auto',
            }}
            >
              {recentConfigs.map((rc, i) => (
                <button
                  key={`${rc.portName}-${rc.baudRate}-${i}`}
                  onClick={() => handleRecentSelect(rc)}
                  style={{
                    background: hoveredRecent === i ? 'var(--color-accent)' : 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: hoveredRecent === i ? '#fff' : 'var(--color-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={() => setHoveredRecent(i)}
                  onMouseLeave={() => setHoveredRecent(null)}
                >
                  {rc.portName} @ {rc.baudRate.toLocaleString()} ({rc.dataBits}{rc.parity[0].toUpperCase()}{rc.stopBits})
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border)',
        }}
        >
          <button
            onClick={() => { toggleConnectionDialog(false); onClose() }}
            style={{
              padding: '5px 16px',
              fontSize: '12px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting || !config.portName}
            style={{
              padding: '5px 16px',
              fontSize: '12px',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: connecting || !config.portName ? 'not-allowed' : 'pointer',
              opacity: connecting || !config.portName ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {connecting ? t('connection.connecting') : t('connection.connect')}
          </button>
        </div>
      </div>
    </div>
  )
}

// === Helpers: map numeric values to Tauri command string format ===

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
