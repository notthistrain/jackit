import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

interface SourceBadgeProps {
  scope: 'global' | 'project' | 'user' | 'plugin' | 'models'
  className?: string
}

const scopeStyles = {
  global: 'bg-border text-muted',
  project: 'bg-primary-light text-primary',
  user: 'bg-border text-muted-foreground',
  plugin: 'bg-border text-muted-foreground',
  models: 'bg-success-light text-success',
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
  const label = scope === 'models' ? '🧠' : t(scopeLabelKeys[scope])

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[9px] rounded-[8px] whitespace-nowrap',
        scopeStyles[scope],
        className,
      )}
    >
      {label}
    </span>
  )
}
