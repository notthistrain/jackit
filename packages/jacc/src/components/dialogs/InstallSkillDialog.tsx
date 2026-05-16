import { useState } from 'react'
import type { SkillInfo } from '@/hooks/useSkills'
import { useT } from '@/i18n'

interface GithubInstallResult {
  temp_dir: string
  skills: SkillInfo[]
}

interface InstallSkillDialogProps {
  open: boolean
  onClose: () => void
  onFetch: (repoUrl: string) => Promise<GithubInstallResult>
  onConfirm: (tempDir: string, skillNames: string[]) => Promise<void>
}

export function InstallSkillDialog({ open, onClose, onFetch, onConfirm }: InstallSkillDialogProps) {
  const { t } = useT()
  const [repoUrl, setRepoUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [available, setAvailable] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState(false)
  const [tempDir, setTempDir] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  async function handleFetch() {
    if (!repoUrl.trim()) return
    setFetching(true)
    setAvailable([])
    setSelected(new Set())
    setError('')
    try {
      const result = await onFetch(repoUrl)
      setTempDir(result.temp_dir)
      setAvailable(result.skills)
      if (result.skills.length === 0) {
        setError(t('skills.install.noSkills'))
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setFetching(false)
    }
  }

  function toggleSkill(name: string) {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelected(next)
  }

  async function handleInstall() {
    if (selected.size === 0 || !tempDir) return
    setInstalling(true)
    try {
      await onConfirm(tempDir, Array.from(selected))
      onClose()
      setRepoUrl('')
      setAvailable([])
      setSelected(new Set())
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[4px] p-6 w-[420px] shadow-xl">
        <h3 className="text-[15px] font-medium text-foreground mb-4">{t('skills.install.title')}</h3>

        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">{t('skills.install.repoLabel')}</div>
          <div className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder={t('skills.install.repoPlaceholder')}
              className="flex-1 bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !repoUrl.trim()}
              className="px-3 py-2 bg-primary text-white text-[11px] rounded-[4px] disabled:opacity-50 whitespace-nowrap"
            >
              {fetching ? t('skills.install.fetching') : t('skills.install.fetch')}
            </button>
          </div>
        </div>

        {fetching && (
          <div className="mb-4 px-3.5 py-2.5 bg-sidebar border border-border-light rounded-[4px] text-[11px] text-muted">
            {t('skills.install.cloning')}
          </div>
        )}

        {error && (
          <div className="mb-4 px-3.5 py-2.5 bg-danger-light border border-danger/30 rounded-[4px] text-[11px] text-danger">
            {error}
          </div>
        )}

        {available.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] text-muted mb-2">{t('skills.install.selectLabel')}</div>
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {available.map((skill) => (
                <label
                  key={skill.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-[4px] cursor-pointer border ${
                    selected.has(skill.name)
                      ? 'bg-success-light border-success/30'
                      : 'bg-sidebar border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(skill.name)}
                    onChange={() => toggleSkill(skill.name)}
                    className="accent-success"
                  />
                  <div>
                    <div className="text-xs font-medium text-foreground">{skill.name}</div>
                    <div className="text-[10px] text-muted">{skill.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px]"
          >
            {t('skills.install.cancel')}
          </button>
          {available.length > 0 && (
            <button
              onClick={handleInstall}
              disabled={installing || selected.size === 0}
              className="px-4 py-2 bg-success text-white text-xs rounded-[4px] disabled:opacity-50"
            >
              {installing ? t('skills.install.installing') : t('skills.install.install', { count: String(selected.size) })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
