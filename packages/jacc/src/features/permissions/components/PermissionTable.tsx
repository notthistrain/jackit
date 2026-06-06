import type { PermissionRule } from '../api/permissions-api'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { permissionTableVariants } from './permission-table.variants'

export interface PermissionTableProps {
  kind: 'allow' | 'deny'
  rules: PermissionRule[]
  scope: 'global' | 'project'
  onDelete: (index: number) => void
  t: (key: string, params?: Record<string, string>) => string
}

export function PermissionTable({
  kind,
  rules,
  scope,
  onDelete,
  t,
}: PermissionTableProps) {
  const styles = permissionTableVariants({ kind })

  const title = kind === 'allow' ? t('permissions.allow') : t('permissions.deny')
  const emptyText = kind === 'allow' ? t('permissions.noAllow') : t('permissions.noDeny')
  const badgeText = kind === 'allow' ? 'Allow' : 'Deny'
  const iconText = kind === 'allow' ? '✓' : '✗'
  const headers = {
    type: t('permissions.header.type'),
    tool: t('permissions.header.tool'),
    pattern: t('permissions.header.pattern'),
    source: t('permissions.header.source'),
  }

  return (
    <div className={styles.root()}>
      <div className={styles.title()}>
        <span>{iconText}</span>
        {' '}
        {title}
      </div>
      <div className={styles.table()}>
        <div className={styles.header()}>
          <div className={styles.headerType()}>{headers.type}</div>
          <div className={styles.headerTool()}>{headers.tool}</div>
          <div className={styles.headerPattern()}>{headers.pattern}</div>
          <div className={styles.headerSource()}>{headers.source}</div>
          <div className={styles.headerAction()}></div>
        </div>
        {rules.map((rule, i) => (
          <div key={i} className={styles.row()}>
            <div className={styles.cellType()}>
              <span className={styles.badge()}>{badgeText}</span>
            </div>
            <div className={styles.cellTool()}>{rule.tool}</div>
            <div className={styles.cellPattern()}>{rule.pattern}</div>
            <div className={styles.cellSource()}>
              <SourceBadge scope={scope} />
            </div>
            <div className={styles.cellAction()}>
              <button onClick={() => onDelete(i)} className={styles.deleteButton()}>×</button>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className={styles.empty()}>{emptyText}</div>
        )}
      </div>
    </div>
  )
}
