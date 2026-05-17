import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'
import { useT } from '@/i18n'

interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export function McpServers() {
  const { t } = useT()
  const { config, writeConfig } = useConfig()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')

  const mcpItem = config?.items.find((i) => i.key === 'mcpServers')
  const servers = (mcpItem?.value as Record<string, McpServer>) || {}
  const mcpScope = mcpItem?.scope || 'global'

  async function handleSave(name: string, server: McpServer) {
    const updated = { ...servers, [name]: server }
    await writeConfig(mcpScope, 'mcpServers', updated)
  }

  async function handleDelete(name: string) {
    const updated = { ...servers }
    delete updated[name]
    await writeConfig(mcpScope, 'mcpServers', updated)
    setExpanded(null)
  }

  async function handleAdd() {
    if (!newName.trim() || !newCommand.trim()) return
    const server: McpServer = {
      command: newCommand,
      args: newArgs ? newArgs.split(' ') : undefined,
    }
    const updated = { ...servers, [newName]: server }
    await writeConfig(mcpScope, 'mcpServers', updated)
    setNewName('')
    setNewCommand('')
    setNewArgs('')
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('mcp.title')}</h2>

      <div className="flex flex-col gap-2">
        {Object.entries(servers).map(([name, server]) => (
          <div
            key={name}
            className={`bg-card border rounded-[4px] overflow-hidden ${
              expanded === name ? 'border-primary' : 'border-border-light'
            }`}
          >
            {/* 折叠头 */}
            <div
              onClick={() => setExpanded(expanded === name ? null : name)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 bg-success rounded-full" />
                <div>
                  <div className="text-[13px] font-medium text-foreground">{name}</div>
                  <div className="text-[11px] text-muted">
                    {server.command} {server.args?.join(' ') || ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge scope={mcpScope} />
                {expanded === name ? (
                  <ChevronUp size={14} className="text-muted" />
                ) : (
                  <ChevronDown size={14} className="text-muted" />
                )}
              </div>
            </div>

            {/* 展开详情 */}
            {expanded === name && (
              <div className="px-4 pb-3.5 border-t border-border-light">
                <div className="flex flex-col gap-2.5 pt-3">
                  <div>
                    <div className="text-[11px] text-muted mb-1">{t('mcp.command')}</div>
                    <input
                      value={server.command}
                      onChange={(e) => handleSave(name, { ...server, command: e.target.value })}
                      className="w-full bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">{t('mcp.args')}</div>
                    <input
                      value={server.args?.join(' ') || ''}
                      onChange={(e) =>
                        handleSave(name, {
                          ...server,
                          args: e.target.value ? e.target.value.split(' ') : undefined,
                        })
                      }
                      className="w-full bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">{t('mcp.env')}</div>
                    <div className="bg-sidebar border border-border rounded-[2px] p-2">
                      {Object.entries(server.env || {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2 items-center mb-1">
                          <input
                            value={k}
                            readOnly
                            className="flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
                          />
                          <span className="text-muted">=</span>
                          <input
                            value={v}
                            onChange={(e) => {
                              const newEnv = { ...server.env, [k]: e.target.value }
                              handleSave(name, { ...server, env: newEnv })
                            }}
                            className="flex-1 bg-card border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => handleDelete(name)}
                      className="text-[11px] px-3 py-1.5 border border-border text-danger rounded-[2px] hover:bg-danger-light"
                    >
                      {t('mcp.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="mt-3 p-3 bg-card border border-border-light rounded-[4px]">
          <div className="text-[13px] font-medium text-foreground mb-3">{t('mcp.add.title')}</div>
          <div className="flex flex-col gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('mcp.add.name')} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs text-foreground" />
            <input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder={t('mcp.add.command')} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground" />
            <input value={newArgs} onChange={(e) => setNewArgs(e.target.value)} placeholder={t('mcp.add.args')} className="bg-sidebar border border-border px-2.5 py-1.5 rounded-[2px] text-xs font-mono text-foreground" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-border text-xs text-muted rounded-[2px]">{t('mcp.add.cancel')}</button>
              <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-white text-xs rounded-[2px]">{t('mcp.add.submit')}</button>
            </div>
          </div>
        </div>
      )}

      <Fab onClick={() => setShowAdd(true)} />
    </div>
  )
}
