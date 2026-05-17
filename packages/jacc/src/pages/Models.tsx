import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels, type Model } from '@/hooks/useModels'
import { useT } from '@/i18n'

export function Models() {
  const { t } = useT()
  const { models, add, test, remove, update } = useModels()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Model | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menuOpen === null) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function formatTestResult(raw: string): string {
    if (raw === 'CONNECTION_SUCCESS') return t('models.testSuccess')
    if (raw.startsWith('CONNECTION_FAILED:')) return t('models.testFailed', { error: raw.slice(18) })
    if (raw.startsWith('HTTP_ERROR:')) return t('models.testFailed', { error: raw.slice(11) })
    return raw
  }

  async function handleTest(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg: formatTestResult(msg), ok: true })
    } catch (e) {
      setTestResult({ id, msg: formatTestResult(String(e)), ok: false })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('models.title')}</h2>

      <div className="flex flex-col gap-2">
        {models.map((model) => (
          <div
            key={model.id}
            className="flex items-center justify-between px-4 py-3 bg-card border border-border-light rounded-[4px]"
          >
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-[13px] font-medium text-foreground">{model.alias}</div>
              <div className="text-[11px] text-muted truncate">
                {model.base_url} · {model.model_name}
                {model.context_size && ` · ${model.context_size}`}
              </div>
              {testResult?.id === model.id && (
                <div className={`text-[10px] mt-1 truncate ${testResult.ok ? 'text-success' : 'text-danger'}`} title={testResult.msg}>
                  {testResult.msg}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleTest(model.id)}
                disabled={testing === model.id}
                className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50 cursor-pointer"
              >
                {testing === model.id ? '...' : t('models.test')}
              </button>
              <div className="relative" ref={menuOpen === model.id ? menuRef : undefined}>
                <button
                  onClick={() => setMenuOpen(menuOpen === model.id ? null : model.id)}
                  className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar cursor-pointer"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen === model.id && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-10 py-1 min-w-[80px]">
                    <button
                      onClick={() => { setEditing(model); setMenuOpen(null) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-sidebar"
                    >
                      {t('models.edit')}
                    </button>
                    <button
                      onClick={() => { remove(model.id); setMenuOpen(null) }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-danger hover:bg-sidebar"
                    >
                      {t('models.delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {models.length === 0 && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] text-xs text-muted text-center">
          {t('models.empty')}
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
      <AddModelDialog open={showAdd} onClose={() => setShowAdd(false)} onSubmit={add} />
      <AddModelDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (editing) {
            await update(editing.id, {
              alias: input.alias,
              base_url: input.base_url,
              api_key: input.api_key || undefined,
              model_name: input.model_name,
              context_size: input.context_size === null ? undefined : input.context_size,
            })
          }
        }}
        initialValues={editing ? {
          alias: editing.alias,
          base_url: editing.base_url,
          api_key: '',
          model_name: editing.model_name,
          context_size: editing.context_size || '',
        } : undefined}
      />
    </div>
  )
}
