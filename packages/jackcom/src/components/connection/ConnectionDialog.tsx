import { useState, useCallback, useRef, useEffect } from 'react'
import { useT } from '@/i18n'
import { useSerialConfig } from '@/hooks/useSerialConfig'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useMainStore } from '@/lib/store'
import { SerialConfigForm } from './SerialConfigForm'
import { connectionDialog } from './connection-dialog.variants'

interface ConnectionDialogProps {
  onClose: () => void
}

export function ConnectionDialog({ onClose }: ConnectionDialogProps) {
  const { t } = useT()
  const { config, setConfig, recentConfigs, saveAsRecent } = useSerialConfig()
  const { open } = useSerialPort()
  const { toggleConnectionDialog } = useMainStore()
  const [connecting, setConnecting] = useState(false)
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [hoveredRecent, setHoveredRecent] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    overlay, dialog, titleBar, titleText, closeBtn,
    body, recentList, recentHeader, recentItem, recentPort, recentDetail,
    configArea, error, spacer, actions, cancelBtn, connectBtn,
  } = connectionDialog()

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleConnect = useCallback(async (overrideConfig?: typeof config) => {
    const cfg = overrideConfig ?? config
    if (!cfg.portName) {
      setErrMsg('Please select a port')
      return
    }
    setConnecting(true)
    setErrMsg(null)
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
      setErrMsg(e instanceof Error ? e.message : String(e))
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
      className={overlay()}
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
        className={dialog()}
      >
        {/* Title bar */}
        <div className={titleBar()}>
          <span className={titleText()}>
            {t('connection.title')}
          </span>
          <button
            onClick={handleClose}
            className={closeBtn()}
          >
            ✕
          </button>
        </div>

        {/* Two-column layout */}
        <div className={body()}>
          {/* Left: Recent connections */}
          {recentConfigs.length > 0 && (
            <div className={recentList()}>
              <div className={recentHeader()}>
                RECENT
              </div>
              {recentConfigs.map((rc, i) => (
                <div
                  key={`${rc.portName}-${rc.baudRate}-${i}`}
                  onClick={() => handleRecentConnect(rc)}
                  onMouseEnter={() => setHoveredRecent(i)}
                  onMouseLeave={() => setHoveredRecent(null)}
                  className={recentItem({ hovered: hoveredRecent === i })}
                >
                  <div className={recentPort()}>
                    {rc.portName}
                  </div>
                  <div className={recentDetail()}>
                    {rc.baudRate.toLocaleString()} {rc.dataBits}{rc.parity[0].toUpperCase()}{rc.stopBits}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Right: Config form + buttons */}
          <div className={configArea()}>
            <SerialConfigForm config={config} onChange={setConfig} />

            {/* Error */}
            {errorMsg && (
              <div className={error()}>
                {errorMsg}
              </div>
            )}

            {/* Spacer */}
            <div className={spacer()} />

            {/* Actions */}
            <div className={actions()}>
              <button
                onClick={handleClose}
                className={cancelBtn()}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleConnect()}
                disabled={connecting || !config.portName}
                className={connectBtn({ disabled: connecting || !config.portName })}
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
