import type { McpServer } from '@/features/mcp-servers/hooks/useMcpServers'
import { useState } from 'react'
import { AddMcpServerForm } from '@/features/mcp-servers/components/AddMcpServerForm'
import { McpServerItem } from '@/features/mcp-servers/components/McpServerItem'
import { useMcpServers } from '@/features/mcp-servers/hooks/useMcpServers'
import { useT } from '@/i18n'
import { Fab } from '@/shared/components/ui/Fab'

export function McpServers() {
  const { t } = useT()
  const { servers, scope, save, remove, add } = useMcpServers()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', command: '', args: '' })

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
      <h2 className="text-base font-medium text-foreground mb-4">{t('mcp.title')}</h2>

      <div className="flex flex-col gap-2">
        {Object.entries(servers).map(([name, server]) => (
          <McpServerItem
            key={name}
            name={name}
            server={server as McpServer}
            expanded={expanded === name}
            scope={scope}
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
    </div>
  )
}
