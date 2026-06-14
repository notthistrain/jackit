import { useT } from '@/i18n'
import { sourceBadge } from './source-badge.variants'

export interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models' | 'shared' | 'local'
  className?: string
}

const scopeLabelKeys: Record<Exclude<SourceBadgeProps['scope'], 'models'>, string> = {
  global: 'source.global',
  project: 'source.project',
  user: 'source.user',
  plugin: 'source.plugin',
  shared: 'source.shared',
  local: 'source.local',
}

export function SourceBadge({ scope, className }: SourceBadgeProps) {
  const { t } = useT()
  const { root } = sourceBadge({ scope })
  const label = scope === 'models' ? '🧠' : t(scopeLabelKeys[scope])

  return <span className={root({ className })}>{label}</span>
}
