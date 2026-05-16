import { useRef, useState } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'

const MODEL_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL']

export function EnvVars() {
  const { config, writeConfig, deleteConfig } = useConfig()
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const pendingRef = useRef<Record<string, string>>({})

  const envItem = config?.items.find((i) => i.key === 'env')
  const envObj = (envItem?.value as Record<string, string>) || {}
  const envScope = envItem?.scope || 'global'

  const entries = Object.entries(envObj)
  const regularEntries = entries.filter(([key]) => !MODEL_ENV_KEYS.includes(key))
  const modelEntries = entries.filter(([key]) => MODEL_ENV_KEYS.includes(key))

  async function handleAdd() {
    if (!newKey.trim()) return
    const updated = { ...envObj, [newKey]: newValue }
    await writeConfig(envScope, 'env', updated)
    setNewKey('')
    setNewValue('')
    setShowAdd(false)
  }

  async function handleDelete(key: string) {
    const updated = { ...envObj }
    delete updated[key]
    await writeConfig(envScope, 'env', updated)
  }

  function handleLocalChange(key: string, value: string) {
    pendingRef.current[key] = value
  }

  async function handleBlur(key: string) {
    if (key in pendingRef.current) {
      const updated = { ...envObj, [key]: pendingRef.current[key] }
      delete pendingRef.current[key]
      await writeConfig(envScope, 'env', updated)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">环境变量</h2>

      {/* 模型变量提示 */}
      {modelEntries.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-light border border-warning/30 rounded-[4px] mb-4 text-[11px] text-warning">
          <span>💡</span>
          <span>ANTHROPIC_BASE_URL、ANTHROPIC_AUTH_TOKEN 等模型相关变量由「模型库」统一管理</span>
        </div>
      )}

      {/* 表格 */}
      <div className="bg-card border border-border-light rounded-[4px] overflow-hidden">
        {/* 表头 */}
        <div className="flex px-3.5 py-2 bg-sidebar border-b border-border-light text-[11px] text-muted font-medium">
          <div className="flex-[2]">变量名</div>
          <div className="flex-[3]">值</div>
          <div className="w-[50px] text-center">来源</div>
          <div className="w-[30px]"></div>
        </div>

        {/* 普通变量 */}
        {regularEntries.map(([key, value]) => (
          <div key={key} className="flex items-center px-3.5 py-2.5 border-b border-border-light/50">
            <div className="flex-[2] text-xs font-mono font-medium text-foreground">{key}</div>
            <div className="flex-[3]">
              <input
                defaultValue={value}
                onChange={(e) => handleLocalChange(key, e.target.value)}
                onBlur={() => handleBlur(key)}
                className="w-[90%] bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
              />
            </div>
            <div className="w-[50px] text-center">
              <SourceBadge scope={envScope} />
            </div>
            <div className="w-[30px] text-center">
              <button onClick={() => handleDelete(key)} className="text-border hover:text-danger text-sm">
                ×
              </button>
            </div>
          </div>
        ))}

        {/* 模型管理的变量（只读） */}
        {modelEntries.map(([key]) => (
          <div key={key} className="flex items-center px-3.5 py-2.5 border-b border-border-light/50 opacity-50">
            <div className="flex-[2] text-xs font-mono text-muted">{key}</div>
            <div className="flex-[3] text-[11px] text-muted italic">由模型库管理</div>
            <div className="w-[50px] text-center">
              <SourceBadge scope="models" />
            </div>
            <div className="w-[30px]"></div>
          </div>
        ))}
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-3 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-[11px] text-muted mb-1">变量名</div>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="MY_VAR"
                className="w-full bg-sidebar border border-border px-2 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
              />
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-muted mb-1">值</div>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="w-full bg-sidebar border border-border px-2 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
              />
            </div>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">
              添加
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">
              取消
            </button>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
