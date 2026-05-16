import { SkillList } from '@/components/SkillList'
import { useSkills } from '@/hooks/useSkills'

export function Agents() {
  const { skills, loading, toggle, importSkill, installFromGithub, confirmInstall } = useSkills()

  return (
    <SkillList
      title="Agents"
      skills={skills}
      loading={loading}
      onToggle={toggle}
      onImport={importSkill}
      onInstallFromGithub={installFromGithub}
      onConfirmInstall={confirmInstall}
    />
  )
}
