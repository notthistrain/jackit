import { open } from '@tauri-apps/plugin-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { InstallSkillDialog } from '@/components/dialogs/InstallSkillDialog'
import type { SkillInfo } from '@/hooks/useSkills'
import { SourceBadge } from '@/components/SourceBadge'
import { Fab } from '@/components/Fab'

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
  title,
  skills,
  loading,
  onToggle,
  onImport,
  onInstallFromGithub,
  onConfirmInstall,
}: SkillListProps) {
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  )

  const enabledCount = skills.filter((s) => s.enabled).length
  const disabledCount = skills.filter((s) => !s.enabled).length

  async function handleImport() {
    const selected = await open({ directory: true })
    if (selected) {
      await onImport(selected)
    }
    setShowMenu(false)
  }

  if (loading) {
    return <div className="p-6 text-xs text-muted">加载中...</div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`搜索 ${title.toLowerCase()}...`}
            className="bg-card border border-border pl-7 pr-3 py-1.5 rounded-[4px] text-xs text-foreground w-[160px]"
          />
        </div>
      </div>

      <div className="flex gap-4 mb-4 text-[11px] text-muted">
        <span>共 {skills.length} 个</span>
        <span>·</span>
        <span className="text-success">{enabledCount} 已启用</span>
        <span>·</span>
        <span className="text-danger">{disabledCount} 已禁用</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {filtered.map((skill) => (
          <div
            key={skill.name}
            className={`flex items-center justify-between px-3.5 py-2.5 bg-card border border-border-light rounded-[4px] ${
              !skill.enabled ? 'opacity-50' : ''
            }`}
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
              <button
                onClick={() => onToggle(skill.name, !skill.enabled)}
                className={`w-9 h-5 rounded-full relative transition-colors ${
                  skill.enabled ? 'bg-success' : 'bg-border'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                    skill.enabled ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
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
            从本地导入
          </button>
          <button
            onClick={() => { setShowInstall(true); setShowMenu(false) }}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
          >
            从 GitHub 安装
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
