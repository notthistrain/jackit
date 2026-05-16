import { cn } from '@/lib/utils'

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

const scopeLabels = {
  global: '全局',
  project: '项目',
  user: '用户',
  plugin: '插件',
  models: '🧠',
}

export function SourceBadge({ scope, className }: SourceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[9px] rounded-[8px] whitespace-nowrap',
        scopeStyles[scope],
        className,
      )}
    >
      {scopeLabels[scope]}
    </span>
  )
}
