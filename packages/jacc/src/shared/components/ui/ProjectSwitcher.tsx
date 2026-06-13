import type { Project } from '@/shared/hooks/useProjects'
import { open } from '@tauri-apps/plugin-dialog'
import { ChevronDown, FolderOpen, Pin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useProjects } from '@/shared/hooks/useProjects'
import { useAppStore } from '@/stores/useAppStore'
import { projectSwitcher } from './project-switcher.variants'

export function ProjectSwitcher() {
  const { t } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { currentProject, setProject } = useAppStore()
  const { projects, add, open: openProject, pin } = useProjects()

  const {
    root,
    trigger,
    triggerLeft,
    triggerLabel,
    triggerValue,
    triggerIcon,
    dropdown,
    currentSection,
    currentLabel,
    currentName,
    currentPath,
    listSection,
    listTitle,
    listItem,
    listItemIcon,
    listItemContent,
    listItemName,
    listItemPath,
    pinButton,
    footer,
    footerButton,
  } = projectSwitcher()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentName_ = currentProject ? currentProject.split(/[/\\]/).pop() : null

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
    <div ref={ref} className={root()}>
      <button onClick={() => setIsOpen(!isOpen)} className={trigger()}>
        <div className={triggerLeft()}>
          <div className={triggerLabel()}>{t('project.current')}</div>
          <div className={triggerValue()}>{currentName_ || t('project.none')}</div>
        </div>
        <ChevronDown size={14} className={triggerIcon()} />
      </button>

      {isOpen && (
        <div className={dropdown()}>
          {currentProject && (
            <div className={currentSection()}>
              <div className={currentLabel()}>{t('project.currentLabel')}</div>
              <div className={currentName()}>{currentName_}</div>
              <div className={currentPath()}>{currentProject}</div>
            </div>
          )}

          {projects.length > 0 && (
            <div className={listSection()}>
              <div className={listTitle()}>{t('project.recent')}</div>
              {projects
                .filter(p => p.path !== currentProject)
                .slice(0, 5)
                .map(project => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project)}
                    className={listItem()}
                  >
                    <FolderOpen size={12} className={listItemIcon()} />
                    <div className={listItemContent()}>
                      <div className={listItemName()}>{project.name}</div>
                      <div className={listItemPath()}>{project.path}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        pin(project.id, !project.pinned)
                      }}
                      className={pinButton()}
                    >
                      <Pin size={10} className={project.pinned ? 'fill-current' : ''} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className={footer()}>
            <button onClick={handleSelectFolder} className={footerButton()}>
              {t('project.openOther')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
