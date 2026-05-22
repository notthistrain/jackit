import { useCallback, useState } from 'react'
import { useSerialPort } from '@/hooks/useSerialPort'
import { useT } from '@/i18n'
import { hexToBytes } from '@/lib/formatters'
import { useSnippetsStore } from '@/lib/snippets-store'
import { useMainStore } from '@/lib/store'
import { quickSendPanel } from './quick-send-panel.variants'

export function QuickSendPanel() {
  const { t } = useT()
  const { snippets, add, remove } = useSnippetsStore()
  const { send } = useSerialPort()
  const activePortId = useMainStore(s => s.activePortId)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [data, setData] = useState('')

  const {
    root,
    list,
    empty,
    snippet: snippetClass,
    snippetInfo,
    snippetName,
    snippetData,
    sendBtn,
    deleteBtn,
    addForm,
    addInput,
    addActions,
    confirmBtn,
    cancelFormBtn,
    addButton,
  } = quickSendPanel()

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

  const handleSend = useCallback(
    async (hexData: string) => {
      if (!activePortId)
        return
      try {
        await send(activePortId, hexData.replace(/\s+/g, ''))
      }
      catch {
        /* send failure silently ignored */
      }
    },
    [activePortId, send],
  )

  return (
    <div className={root()}>
      <div className={list()}>
        {snippets.length === 0 && <div className={empty()}>{t('sidebar.quickSend.empty')}</div>}
        {snippets.map(snippet => (
          <div key={snippet.id} className={snippetClass()}>
            <div className={snippetInfo()}>
              <div className={snippetName()}>{snippet.name}</div>
              <div className={snippetData()}>{snippet.data}</div>
            </div>
            <button
              title={t('sidebar.quickSend.send')}
              onClick={() => handleSend(snippet.data)}
              disabled={!activePortId}
              className={sendBtn({ active: !!activePortId })}
            >
              ▶
            </button>
            <button title={t('sidebar.quickSend.delete')} onClick={() => remove(snippet.id)} className={deleteBtn()}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className={addForm()}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('sidebar.quickSend.namePlaceholder')}
            className={addInput()}
          />
          <input
            value={data}
            onChange={e => setData(e.target.value)}
            placeholder={t('sidebar.quickSend.dataPlaceholder')}
            className={addInput({ mono: true })}
          />
          <div className={addActions()}>
            <button onClick={handleAdd} className={confirmBtn()}>
              {t('sidebar.quickSend.confirm')}
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setName('')
                setData('')
              }}
              className={cancelFormBtn()}
            >
              {t('sidebar.quickSend.cancel')}
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setAdding(true)} className={addButton({ adding })}>
        +
        {' '}
        {t('sidebar.quickSend.add')}
      </button>
    </div>
  )
}
