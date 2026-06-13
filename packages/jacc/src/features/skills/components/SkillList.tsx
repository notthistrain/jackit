import type { SkillInfo } from '../api/skills-api'
import { open } from '@tauri-apps/plugin-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n'
import { Fab } from '@/shared/components/ui/Fab'
import { InstallSkillDialog } from './InstallSkillDialog'
import { skillList } from './skill-list.variants'
import { SkillListItem } from './SkillListItem'

type Tab = 'enabled' | 'disabled'

export interface SkillListProps {
  skills: SkillInfo[]
  loading: boolean
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onImport: (sourcePath: string) => Promise<void>
  onInstallFromGithub: (repoUrl: string) => Promise<{ token: string, skills: SkillInfo[] }>
  onConfirmInstall: (token: string, skillNames: string[]) => Promise<void>
}

export function SkillList({
  skills,
  loading,
  onToggle,
  onImport,
  onInstallFromGithub,
  onConfirmInstall,
}: SkillListProps) {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('enabled')
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const enabledSkills = skills.filter(s => s.enabled)
  const disabledSkills = skills.filter(s => !s.enabled)

  const currentList = tab === 'enabled' ? enabledSkills : disabledSkills
  const filtered = currentList.filter(
    s =>
      s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleToggle(name: string, enabled: boolean) {
    setToggling(name)
    try {
      await onToggle(name, enabled)
    }
    finally {
      setToggling(null)
    }
  }

  async function handleImport() {
    const selected = await open({ directory: true })
    if (selected) {
      await onImport(selected)
    }
    setShowMenu(false)
  }

  const styles = skillList()

  if (loading) {
    return <div className={styles.loading()}>{t('common.loading')}</div>
  }

  return (
    <div className={styles.root()}>
      {/* Tab 栏 */}
      <div className={styles.tabBar()}>
        <button
          onClick={() => setTab('enabled')}
          className={styles.tab({ active: tab === 'enabled' })}
        >
          {t('skills.tab.enabled')}
          {' '}
          (
          {enabledSkills.length}
          )
        </button>
        <button
          onClick={() => setTab('disabled')}
          className={styles.tab({ active: tab === 'disabled' })}
        >
          {t('skills.tab.disabled')}
          {' '}
          (
          {disabledSkills.length}
          )
        </button>
        <div className={styles.spacer()} />
        <div className={styles.searchWrap()}>
          <Search size={12} className={styles.searchIcon()} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('skills.search')}
            className={styles.searchInput()}
          />
        </div>
      </div>

      {/* 列表 */}
      <div className={styles.list()}>
        {filtered.map(skill => (
          <SkillListItem
            key={skill.name}
            skill={skill}
            toggling={toggling === skill.name}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {showMenu && (
        <div className={styles.menu()}>
          <button onClick={handleImport} className={styles.menuItem()}>
            {t('skills.importLocal')}
          </button>
          <button
            onClick={() => {
              setShowInstall(true)
              setShowMenu(false)
            }}
            className={styles.menuItem()}
          >
            {t('skills.installGithub')}
          </button>
        </div>
      )}
      <Fab onClick={() => setShowMenu(!showMenu)} />

      <InstallSkillDialog
        open={showInstall}
        onClose={() => setShowInstall(false)}
        onFetch={onInstallFromGithub}
        onConfirm={onConfirmInstall}
      />
    </div>
  )
}
