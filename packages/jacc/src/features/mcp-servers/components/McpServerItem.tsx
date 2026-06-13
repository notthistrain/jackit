import type { McpServer } from '../api/mcp-servers-api'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { mcpServerItem } from './mcp-server-item.variants'

export interface McpServerItemProps {
  name: string
  server: McpServer
  expanded: boolean
  scope: 'global' | 'project'
  onToggle: () => void
  onSave: (server: McpServer) => void
  onDelete: () => void
  t: (key: string, params?: Record<string, string>) => string
}

export function McpServerItem({
  name,
  server,
  expanded,
  scope,
  onToggle,
  onSave,
  onDelete,
  t,
}: McpServerItemProps) {
  const {
    root,
    header,
    statusDot,
    nameContainer,
    name: nameClass,
    commandPreview,
    headerRight,
    chevron,
    content,
    contentInner,
    fieldLabel,
    input,
    envContainer,
    envRow,
    envKey,
    envEquals,
    envValue,
    deleteButton,
    buttonContainer,
  } = mcpServerItem({ expanded })

  return (
    <div className={root()}>
      {/* Header */}
      <div onClick={onToggle} className={header()}>
        <div className={nameContainer()}>
          <div className={statusDot()} />
          <div>
            <div className={nameClass()}>{name}</div>
            <div className={commandPreview()}>
              {server.command}
              {' '}
              {server.args?.join(' ') || ''}
            </div>
          </div>
        </div>
        <div className={headerRight()}>
          <SourceBadge scope={scope} />
          {expanded
            ? (
                <ChevronUp size={14} className={chevron()} />
              )
            : (
                <ChevronDown size={14} className={chevron()} />
              )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className={content()}>
          <div className={contentInner()}>
            <div>
              <div className={fieldLabel()}>{t('mcp.command')}</div>
              <input
                value={server.command}
                onChange={e => onSave({ ...server, command: e.target.value })}
                className={input()}
              />
            </div>
            <div>
              <div className={fieldLabel()}>{t('mcp.args')}</div>
              <input
                value={server.args?.join(' ') || ''}
                onChange={e =>
                  onSave({
                    ...server,
                    args: e.target.value ? e.target.value.split(' ') : undefined,
                  })}
                className={input()}
              />
            </div>
            <div>
              <div className={fieldLabel()}>{t('mcp.env')}</div>
              <div className={envContainer()}>
                {Object.entries(server.env || {}).map(([k, v]) => (
                  <div key={k} className={envRow()}>
                    <input
                      value={k}
                      readOnly
                      className={envKey()}
                    />
                    <span className={envEquals()}>=</span>
                    <input
                      value={v}
                      onChange={(e) => {
                        const newEnv = { ...server.env, [k]: e.target.value }
                        onSave({ ...server, env: newEnv })
                      }}
                      className={envValue()}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className={buttonContainer()}>
              <button
                onClick={onDelete}
                className={deleteButton()}
              >
                {t('mcp.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
