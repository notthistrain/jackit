import { open } from '@tauri-apps/plugin-dialog'
import { ChevronDown, FolderOpen, Pin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useProjects, type Project } from '@/hooks/useProjects'
import { useT } from '@/i18n'

export function ProjectSwitcher() {
  const { t } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { currentProject, setProject } = useAppStore()
  const { projects, add, open: openProject, pin } = useProjects()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentName = currentProject
    ? currentProject.split(/[/\\]/).pop()
    : null

  async function handleSelectFolder() {
    const selected = await open({ directory: true })
    if (selected) {
      await add(selected)
      await openProject(selected)
      setProject(selected)
      setIsOpen(false)
    }
  }

  async function handleSwitchProject(project: Project) {
    await openProject(project.path)
    setProject(project.path)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className="relative px-3 pt-3 pb-2 border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-1.5 bg-card border border-border rounded-[4px] flex items-center justify-between cursor-pointer hover:border-muted"
      >
        <div className="text-left">
          <div className="text-[11px] text-muted">{t('project.current')}</div>
          <div className="text-xs font-medium text-foreground truncate">
            {currentName || t('project.none')}
          </div>
        </div>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-[4px] shadow-lg z-50 overflow-hidden">
          {currentProject && (
            <div className="px-3 py-2 bg-primary-light border-b border-border">
              <div className="text-[11px] text-primary">{t('project.currentLabel')}</div>
              <div className="text-xs font-medium text-foreground truncate">{currentName}</div>
              <div className="text-[10px] text-muted truncate">{currentProject}</div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[10px] text-muted">{t('project.recent')}</div>
              {projects
                .filter((p) => p.path !== currentProject)
                .slice(0, 5)
                .map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project)}
                    className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-border/30"
                  >
                    <FolderOpen size={12} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">{project.name}</div>
                      <div className="text-[10px] text-muted truncate">{project.path}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        pin(project.id, !project.pinned)
                      }}
                      className="text-muted hover:text-foreground"
                    >
                      <Pin size={10} className={project.pinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className="border-t border-border px-3 py-2">
            <button
              onClick={handleSelectFolder}
              className="text-xs text-primary cursor-pointer hover:underline"
            >
              {t('project.openOther')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
