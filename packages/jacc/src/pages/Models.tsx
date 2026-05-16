import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Fab } from '@/components/Fab'
import { AddModelDialog } from '@/components/dialogs/AddModelDialog'
import { useModels } from '@/hooks/useModels'

type Slot = 'opus' | 'sonnet' | 'haiku'

export function Models() {
  const { models, add, activate, test, remove } = useModels()
  const [currentSlot, setCurrentSlot] = useState<Slot>('opus')
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  const activeModel = models.find((m) => m.slot === currentSlot)

  async function handleTest(id: number) {
    setTesting(id)
    setTestResult(null)
    try {
      const msg = await test(id)
      setTestResult({ id, msg, ok: true })
    } catch (e) {
      setTestResult({ id, msg: String(e), ok: false })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6">
      {/* 标题 + 槽位切换 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">模型库</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">当前槽位:</span>
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

      {/* 当前激活模型 */}
      {activeModel && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary-light border border-primary/30 rounded-[4px] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <div>
              <div className="text-[13px] font-semibold text-foreground">{activeModel.alias}</div>
              <div className="text-[11px] text-muted">
                {activeModel.base_url} · {activeModel.model_name}
              </div>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 bg-primary text-white rounded-[12px]">已激活</span>
        </div>
      )}

      {!activeModel && (
        <div className="px-4 py-3 bg-sidebar border border-border-light rounded-[4px] mb-4 text-xs text-muted text-center">
          当前槽位未绑定模型
        </div>
      )}

      {/* 模型列表 */}
      <div className="flex flex-col gap-2">
        {models
          .filter((m) => m.slot !== currentSlot)
          .map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between px-4 py-3 bg-card border border-border-light rounded-[4px]"
            >
              <div>
                <div className="text-[13px] font-medium text-foreground">{model.alias}</div>
                <div className="text-[11px] text-muted">
                  {model.base_url} · {model.model_name}
                </div>
                {testResult?.id === model.id && (
                  <div className={`text-[10px] mt-1 ${testResult.ok ? 'text-success' : 'text-danger'}`}>
                    {testResult.msg}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => activate(model.id, currentSlot)}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar"
                >
                  激活
                </button>
                <button
                  onClick={() => handleTest(model.id)}
                  disabled={testing === model.id}
                  className="text-[11px] px-2.5 py-1 bg-card border border-border rounded-[2px] text-foreground hover:bg-sidebar disabled:opacity-50"
                >
                  {testing === model.id ? '...' : '测试'}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === model.id ? null : model.id)}
                    className="text-[11px] px-2 py-1 bg-card border border-border rounded-[2px] text-muted hover:bg-sidebar"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen === model.id && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-10 py-1 min-w-[80px]">
                      <button
                        onClick={() => { remove(model.id); setMenuOpen(null) }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-danger hover:bg-sidebar"
                      >
                        删除
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
    </div>
  )
}
