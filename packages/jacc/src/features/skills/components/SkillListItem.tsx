import type { SkillInfo } from '../api/skills-api'
import { useT } from '@/i18n'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { skillListItem } from './skill-list-item.variants'

export interface SkillListItemProps {
  skill: SkillInfo
  toggling: boolean
  onToggle: (name: string, enabled: boolean) => void
}

export function SkillListItem({ skill, toggling, onToggle }: SkillListItemProps) {
  const { t } = useT()
  const { root, main, icon, info, name, description, actions, readonly, toggle, knob } = skillListItem({
    enabled: skill.enabled,
    toggling,
  })

  return (
    <div className={root()}>
      <div className={main()}>
        <div className={icon()}>{'\u{1F9E9}'}</div>
        <div className={info()}>
          <div className={name()}>{skill.name}</div>
          <div className={description()}>{skill.description}</div>
        </div>
      </div>
      <div className={actions()}>
        <SourceBadge scope={skill.source as 'project' | 'user' | 'plugin'} />
        {skill.source === 'user'
          ? (
              <span className={readonly()}>{t('skills.readonly')}</span>
            )
          : (
              <button
                onClick={() => onToggle(skill.name, !skill.enabled)}
                disabled={toggling}
                className={toggle()}
              >
                <div className={knob()} />
              </button>
            )}
      </div>
    </div>
  )
}
