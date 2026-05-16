import { open } from '@tauri-apps/plugin-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { InstallSkillDialog } from '@/components/dialogs/InstallSkillDialog'
import type { SkillInfo } from '@/hooks/useSkills'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'
import { useT } from '@/i18n'

type Tab = 'enabled' | 'disabled'

interface SkillListProps {
  title: string
  skills: SkillInfo[]
  loading: boolean
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onImport: (sourcePath: string) => Promise<void>
  onInstallFromGithub: (repoUrl: string) => Promise<{ temp_dir: string; skills: SkillInfo[] }>
  onConfirmInstall: (tempDir: string, skillNames: string[]) => Promise<void>
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

  const enabledSkills = skills.filter((s) => s.enabled)
  const disabledSkills = skills.filter((s) => !s.enabled)

  const currentList = tab === 'enabled' ? enabledSkills : disabledSkills
  const filtered = currentList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleToggle(name: string, enabled: boolean) {
    setToggling(name)
    try {
      await onToggle(name, enabled)
    } finally {
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

  if (loading) {
    return <div className="p-6 text-xs text-muted">{t('common.loading')}</div>
  }

  return (
    <div className="p-6 pb-20">
      {/* Tab 栏 */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setTab('enabled')}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            tab === 'enabled'
              ? 'text-foreground border-primary'
              : 'text-muted border-transparent hover:text-foreground'
          }`}
        >
          {t('skills.tab.enabled')} ({enabledSkills.length})
        </button>
        <button
          onClick={() => setTab('disabled')}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
            tab === 'disabled'
              ? 'text-foreground border-primary'
              : 'text-muted border-transparent hover:text-foreground'
          }`}
        >
          {t('skills.tab.disabled')} ({disabledSkills.length})
        </button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('skills.search')}
            className="bg-card border border-border pl-7 pr-3 py-1.5 rounded-[4px] text-xs text-foreground w-[160px]"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex flex-col gap-1.5">
        {filtered.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between px-3.5 py-2.5 bg-card border border-border-light rounded-[4px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-success-light rounded-[4px] flex items-center justify-center text-base shrink-0">
                {'\u{1F9E9}'}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{skill.name}</div>
                <div className="text-[11px] text-muted truncate max-w-[300px]">{skill.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SourceBadge scope={skill.source as 'project' | 'user' | 'plugin'} />
              {skill.source === 'user' ? (
                <span className="text-[10px] text-muted">{t('skills.readonly')}</span>
              ) : (
                <button
                  onClick={() => handleToggle(skill.name, !skill.enabled)}
                  disabled={toggling === skill.name}
                  className={`w-9 h-5 rounded-full relative transition-colors ${
                    skill.enabled ? 'bg-success' : 'bg-border'
                  } ${toggling === skill.name ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      skill.enabled ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showMenu && (
        <div className="fixed bottom-20 right-6 bg-card border border-border rounded-[4px] shadow-lg py-1 min-w-[140px] z-40">
          <button
            onClick={handleImport}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
          >
            {t('skills.importLocal')}
          </button>
          <button
            onClick={() => { setShowInstall(true); setShowMenu(false) }}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
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
