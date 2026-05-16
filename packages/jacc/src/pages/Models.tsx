import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels, type Model } from '@/hooks/useModels'
import { useT } from '@/i18n'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function Models() {
  const { t } = useT()
  const { models, add, bind, test, remove, update } = useModels()
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Model | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const boundModel = models.find((m) => m.slot === currentSlot)

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('models.title')}</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">{t('models.slot.label')}:</span>
          <select
            value={currentSlot}
            onChange={(e) => setCurrentSlot(e.target.value as Slot)}
            className="bg-card border border-border px-3 py-1.5 rounded-[4px] text-xs font-medium text-foreground"
          >
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
            <option value="haiku">Haiku</option>
          </select>
        </div>
      </div>

      {boundModel && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary-light border border-primary/30 rounded-[4px] mb-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
            <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">{boundModel.alias}</div>
              <div className="text-[11px] text-muted truncate">
                {boundModel.base_url} · {boundModel.model_name}
                {boundModel.context_size && ` · ${boundModel.context_size}`}
              </div>
              {testResult?.id === boundModel.id && (
                <div className={`text-[10px] mt-1 truncate ${testResult.ok ? 'text-success' : 'text-danger'}`} title={testResult.msg}>
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleTest(boundModel.id)}
              disabled={testing === boundModel.id}
              className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50"
            >
              {testing === boundModel.id ? '...' : t('models.test')}
            </button>
            <button
              onClick={() => setEditing(boundModel)}
              className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar"
            >
              {t('models.edit')}
            </button>
            <span className="text-[11px] px-2.5 py-1 bg-primary text-white rounded-[12px] ml-1">{t('models.bound')}</span>
          </div>
        </div>
      )}

      {!boundModel && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] mb-4 text-xs text-muted text-center">
          {t('models.unbound')}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {models
          .filter((m) => m.slot !== currentSlot)
          .map((model) => (
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
                  onClick={() => bind(model.id, currentSlot)}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar cursor-pointer"
                >
                  {t('models.bind', { slot: currentSlot })}
                </button>
                <button
                  onClick={() => handleTest(model.id)}
                  disabled={testing === model.id}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50 cursor-pointer"
                >
                  {testing === model.id ? '...' : t('models.test')}
                </button>
                <div className="relative">
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
              context_size: input.context_size || undefined,
            })
          }
        }}
        initialValues={editing ? {
          alias: editing.alias,
          base_url: editing.base_url,
          api_key: '',
          model_name: editing.model_name,
          slot: editing.slot || '',
          context_size: editing.context_size || '',
        } : undefined}
      />
    </div>
  )
}
