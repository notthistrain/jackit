import type { PermissionRule } from '../api/permissions-api'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { permissionTableVariants } from './permission-table.variants'

export interface PermissionTableProps {
  kind: 'allow' | 'deny'
  title: string
  rules: PermissionRule[]
  scope: 'global' | 'project'
  emptyText: string
  badgeText: string
  iconText: string
  headers: { type: string, tool: string, pattern: string, source: string }
  onDelete: (index: number) => void
}

export function PermissionTable({
  kind,
  title,
  rules,
  scope,
  emptyText,
  badgeText,
  iconText,
  headers,
  onDelete,
}: PermissionTableProps) {
  const styles = permissionTableVariants({ kind })

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
