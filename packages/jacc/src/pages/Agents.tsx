import { SkillList } from '@/components/SkillList'
import { useSkills } from '@/hooks/useSkills'

export function Agents() {
  const { skills, loading, toggle, importSkill, installFromGithub, confirmInstall } = useSkills()

  const agents = skills.filter((s) => s.source === 'agent')

  return (
    <SkillList
      title="Agents"
      skills={agents.length > 0 ? agents : skills}
      loading={loading}
      onToggle={toggle}
      onImport={importSkill}
      onInstallFromGithub={installFromGithub}
      onConfirmInstall={confirmInstall}
    />
  )
}
