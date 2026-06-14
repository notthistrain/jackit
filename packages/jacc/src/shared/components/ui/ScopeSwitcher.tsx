import { useT } from '@/i18n'
import type { ConfigScope } from '@/stores/useAppStore'
import { scopeSwitcher } from './scope-switcher.variants'

export interface ScopeSwitcherProps {
  value: ConfigScope
  onChange: (scope: ConfigScope) => void
  className?: string
}

const OPTIONS: ConfigScope[] = ['global', 'project']

export function ScopeSwitcher({ value, onChange, className }: ScopeSwitcherProps) {
  const { t } = useT()
  const { root, label, group } = scopeSwitcher()
  return (
    <div className={root({ className })}>
      <span className={label()}>{t('scope.label')}</span>
      <div className={group()}>
        {OPTIONS.map((scope) => {
          const active = value === scope
          return (
            <button
              key={scope}
              type="button"
              aria-pressed={active}
              onClick={() => !active && onChange(scope)}
              className={scopeSwitcher({ scope, active }).option()}
            >
              {t(`source.${scope}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
