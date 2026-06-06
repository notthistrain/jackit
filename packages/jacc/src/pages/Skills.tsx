import { SkillList } from '@/components/SkillList'
import { useSkills } from '@/features/skills/hooks/useSkills'

export function Skills() {
  const { skills, loading, toggle, importSkill, installFromGithub, confirmInstall } = useSkills()

  return (
    <SkillList
      skills={skills}
      loading={loading}
      onToggle={toggle}
      onImport={importSkill}
      onInstallFromGithub={installFromGithub}
      onConfirmInstall={confirmInstall}
    />
  )
}
