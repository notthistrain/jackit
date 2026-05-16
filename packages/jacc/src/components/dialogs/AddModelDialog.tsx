import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { CreateModelInput } from '@/hooks/useModels'

interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateModelInput) => Promise<void>
}

export function AddModelDialog({ open, onClose, onSubmit }: AddModelDialogProps) {
  const [alias, setAlias] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [slot, setSlot] = useState<string>('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!alias || !baseUrl || !apiKey || !modelName) return
    setSubmitting(true)
    try {
      await onSubmit({
        alias,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
        slot: slot || null,
      })
      // 重置表单
      setAlias('')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setSlot('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[400px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-5">添加模型配置</h3>

        <div className="flex flex-col gap-3.5">
          <div>
            <div className="text-[11px] text-muted mb-1">别名 *</div>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="如：Claude Opus 官方"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">API 端点 (Base URL) *</div>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">API Key *</div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-sidebar border border-border px-3 py-2 pr-9 rounded-[4px] text-xs text-foreground"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">模型名称 *</div>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="claude-opus-4-6"
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">默认槽位</div>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            >
              <option value="">不绑定</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px] hover:bg-sidebar"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !alias || !baseUrl || !apiKey || !modelName}
            className="px-4 py-2 bg-primary text-white text-xs rounded-[4px] disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
