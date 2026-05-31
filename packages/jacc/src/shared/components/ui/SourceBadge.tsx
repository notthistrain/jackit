import { useT } from '@/i18n'
import { sourceBadge } from './source-badge.variants'

export interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models'
  className?: string
}

const scopeLabelKeys: Record<string, string> = {
  global: 'source.global',
  project: 'source.project',
  user: 'source.user',
  plugin: 'source.plugin',
  models: '🧠',
}

export function SourceBadge({ scope, className }: SourceBadgeProps) {
  const { t } = useT()
  const { root } = sourceBadge({ scope })
  const label = scope === 'models' ? '🧠' : t(scopeLabelKeys[scope])

  return <span className={root({ className })}>{label}</span>
}
