import { useCallback, useState } from 'react'
import { useT } from '@/i18n'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useMainStore } from '@/lib/store'
import { hexToBytes } from '@/lib/formatters'
import { useSnippetsStore } from '@/lib/snippets-store'

export function QuickSendPanel() {
  const { t } = useT()
  const { snippets, add, remove } = useSnippetsStore()
  const { send } = useSerialPort()
  const { activePortId } = useMainStore()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [data, setData] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = data.trim()
    if (!name.trim() || !trimmed)
      return
    if (hexToBytes(trimmed) === null)
      return
    add(name.trim(), trimmed)
    setName('')
    setData('')
    setAdding(false)
  }, [name, data, add])

  const handleSend = useCallback(async (hexData: string) => {
    if (!activePortId)
      return
    try {
      await send(activePortId, hexData)
    }
    catch (err) {
      console.error('Quick send failed:', err)
    }
  }, [activePortId, send])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
        {snippets.length === 0 && (
          <div style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
            {t('sidebar.quickSend.empty')}
          </div>
        )}
        {snippets.map(snippet => (
          <div
            key={snippet.id}
            style={{
              padding: '6px 8px',
              marginBottom: '2px',
              borderRadius: '3px',
              background: 'var(--color-editor-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>{snippet.name}</div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-secondary)',
                fontFamily: 'Consolas, monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              >
                {snippet.data}
              </div>
            </div>
            <button
              title={t('sidebar.quickSend.send')}
              onClick={() => handleSend(snippet.data)}
              disabled={!activePortId}
              style={{
                background: 'transparent',
                border: 'none',
                color: activePortId ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                cursor: activePortId ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                padding: '2px 4px',
                opacity: activePortId ? 1 : 0.5,
              }}
            >
              ▶
            </button>
            <button
              title={t('sidebar.quickSend.delete')}
              onClick={() => remove(snippet.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '11px',
        }}
        >
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('sidebar.quickSend.namePlaceholder')}
            style={{
              background: 'var(--color-editor-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              padding: '3px 6px',
              color: 'var(--color-text)',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <input
            value={data}
            onChange={e => setData(e.target.value)}
            placeholder={t('sidebar.quickSend.dataPlaceholder')}
            style={{
              background: 'var(--color-editor-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              padding: '3px 6px',
              color: 'var(--color-text)',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleAdd}
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {t('sidebar.quickSend.confirm')}
            </button>
            <button
              onClick={() => { setAdding(false); setName(''); setData('') }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                padding: '2px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {t('sidebar.quickSend.cancel')}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        style={{
          background: 'transparent',
          border: 'none',
          borderTop: adding ? 'none' : '1px solid var(--color-border)',
          color: 'var(--color-accent)',
          cursor: 'pointer',
          padding: '6px',
          fontSize: '11px',
        }}
      >
        + {t('sidebar.quickSend.add')}
      </button>
    </div>
  )
}
