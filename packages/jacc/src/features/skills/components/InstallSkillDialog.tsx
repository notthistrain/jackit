import type { GithubInstallResult, SkillInfo } from '../api/skills-api'
import { useState } from 'react'
import { useT } from '@/i18n'
import { Dialog } from '@/shared/components/ui/Dialog'
import { installSkillDialog } from './install-skill-dialog.variants'
import { SkillSelectList } from './SkillSelectList'

export interface InstallSkillDialogProps {
  open: boolean
  onClose: () => void
  onFetch: (repoUrl: string) => Promise<GithubInstallResult>
  onConfirm: (token: string, skillNames: string[]) => Promise<void>
}

export function InstallSkillDialog({ open, onClose, onFetch, onConfirm }: InstallSkillDialogProps) {
  const { t } = useT()
  const [repoUrl, setRepoUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [available, setAvailable] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const { section, label, fetchRow, statusBox, errorBox, selectLabel, footer } = installSkillDialog()

  async function handleFetch() {
    if (!repoUrl.trim())
      return
    setFetching(true)
    setAvailable([])
    setSelected(new Set())
    setError('')
    try {
      const result = await onFetch(repoUrl)
      setToken(result.token)
      setAvailable(result.skills)
      if (result.skills.length === 0) {
        setError(t('skills.install.noSkills'))
      }
    }
    catch (e) {
      setError(String(e))
    }
    finally {
      setFetching(false)
    }
  }

  function toggleSkill(name: string) {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    }
    else {
      next.add(name)
    }
    setSelected(next)
  }

  async function handleInstall() {
    if (selected.size === 0 || !token)
      return
    setInstalling(true)
    try {
      await onConfirm(token, Array.from(selected))
      onClose()
      setRepoUrl('')
      setAvailable([])
      setSelected(new Set())
    }
    finally {
      setInstalling(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('skills.install.title')}
      footer={(
        <div className={footer()}>
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
      )}
    >
      <div className={section()}>
        <div className={label()}>{t('skills.install.repoLabel')}</div>
        <div className={fetchRow()}>
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
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
        <div className={statusBox()}>{t('skills.install.cloning')}</div>
      )}

      {error && (
        <div className={errorBox()}>{error}</div>
      )}

      {available.length > 0 && (
        <div className={section()}>
          <div className={selectLabel()}>{t('skills.install.selectLabel')}</div>
          <SkillSelectList skills={available} selected={selected} onToggle={toggleSkill} />
        </div>
      )}
    </Dialog>
  )
}
