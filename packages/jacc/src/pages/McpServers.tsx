import type { McpServer } from '@/features/mcp-servers/hooks/useMcpServers'
import { useState } from 'react'
import { AddMcpServerForm } from '@/features/mcp-servers/components/AddMcpServerForm'
import { McpServerItem } from '@/features/mcp-servers/components/McpServerItem'
import { useMcpServers } from '@/features/mcp-servers/hooks/useMcpServers'
import { useT } from '@/i18n'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Fab } from '@/shared/components/ui/Fab'
import { ScopeSwitcher } from '@/shared/components/ui/ScopeSwitcher'
import { useSelectProject } from '@/shared/hooks/useSelectProject'
import { useAppStore } from '@/stores/useAppStore'

export function McpServers() {
  const { t } = useT()
  const { configScope, currentProject, setConfigScope } = useAppStore()
  const { servers, origin, save, remove, add } = useMcpServers()
  const selectProject = useSelectProject()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', command: '', args: '' })
  const showSource = configScope === 'project'
  const needsProject = configScope === 'project' && !currentProject

  async function handleDelete(name: string) {
    await remove(name)
    setExpanded(null)
  }

  async function handleSubmit() {
    if (!newValues.name.trim() || !newValues.command.trim())
      return
    await add(newValues.name, newValues.command, newValues.args)
    setNewValues({ name: '', command: '', args: '' })
    setShowAdd(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-foreground">{t('mcp.title')}</h2>
        <ScopeSwitcher value={configScope} onChange={setConfigScope} />
      </div>

      {needsProject
        ? <EmptyState onSelectProject={selectProject} />
        : (
            <>
              <div className="flex flex-col gap-2">
                {Object.entries(servers).map(([name, server]) => (
                  <McpServerItem
                    key={name}
                    name={name}
                    server={server as McpServer}
                    expanded={expanded === name}
                    origin={origin}
                    showSource={showSource}
                    onToggle={() => setExpanded(expanded === name ? null : name)}
                    onSave={s => save(name, s)}
                    onDelete={() => handleDelete(name)}
                    t={t}
                  />
                ))}
              </div>

              <AddMcpServerForm
                visible={showAdd}
                values={newValues}
                onChange={setNewValues}
                onSubmit={handleSubmit}
                onCancel={() => setShowAdd(false)}
                t={t}
              />

              <Fab onClick={() => setShowAdd(true)} />
            </>
          )}
    </div>
  )
}
