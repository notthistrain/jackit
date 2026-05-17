import { useT } from '@/i18n'

export function Agents() {
  const { t } = useT()

  return (
    <div className="p-6">
      <h2 className="text-base font-medium text-foreground mb-4">{t('agents.title')}</h2>
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <div className="text-sm">{t('agents.developing')}</div>
      </div>
    </div>
  )
}
