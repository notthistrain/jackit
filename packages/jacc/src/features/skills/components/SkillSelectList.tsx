import type { SkillInfo } from '../api/skills-api'
import { skillSelectList } from './skill-select-list.variants'

export interface SkillSelectListProps {
  skills: SkillInfo[]
  selected: Set<string>
  onToggle: (name: string) => void
}

export function SkillSelectList({ skills, selected, onToggle }: SkillSelectListProps) {
  const { root, item, checkbox, name: nameClass, description } = skillSelectList()

  return (
    <div className={root()}>
      {skills.map(skill => (
        <label key={skill.name} className={item({ selected: selected.has(skill.name) })}>
          <input
            type="checkbox"
            checked={selected.has(skill.name)}
            onChange={() => onToggle(skill.name)}
            className={checkbox()}
          />
          <div>
            <div className={nameClass()}>{skill.name}</div>
            <div className={description()}>{skill.description}</div>
          </div>
        </label>
      ))}
    </div>
  )
}
