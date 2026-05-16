# jacc 计划 6：Skills/Agents 管理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 Skills 和 Agents 管理页面，包括列表展示、启用/禁用、本地导入和 GitHub 在线安装

**架构：** Skills 和 Agents 共用相同的数据结构和交互模式。通过 Tauri 命令操作文件系统（移动目录实现启用/禁用，拷贝目录实现导入/安装）。

**技术栈：** React 19, Tailwind CSS 4, @tauri-apps/api, @tauri-apps/plugin-dialog

**前置依赖：** 计划 3（前端核心框架）完成

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/hooks/useSkills.ts` | Skills/Agents 管理 hook |
| `src/pages/Skills.tsx` | Skills 列表页面 |
| `src/pages/Agents.tsx` | Agents 列表页面（复用 Skills 组件） |
| `src/components/dialogs/InstallSkillDialog.tsx` | GitHub 安装弹窗 |
| `src/components/SkillList.tsx` | 通用 Skill/Agent 列表组件 |

---

### 任务 1：useSkills Hook

**文件：**
- 创建：`packages/jacc/src/hooks/useSkills.ts`

- [ ] **步骤 1：创建 useSkills.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  source: string // "project" | "user" | "plugin"
}

export function useSkills() {
  const { currentProject } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const list = await invoke<SkillInfo[]>('list_skills', { projectPath: currentProject })
      setSkills(list)
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  const toggle = useCallback(
    async (name: string, enabled: boolean) => {
      if (!currentProject) return
      await invoke('toggle_skill', { projectPath: currentProject, name, enabled })
      await refresh()
    },
    [currentProject, refresh],
  )

  const importSkill = useCallback(
    async (sourcePath: string) => {
      if (!currentProject) return
      await invoke('import_skill', { projectPath: currentProject, sourcePath })
      await refresh()
    },
    [currentProject, refresh],
  )

  const installFromGithub = useCallback(
    async (repoUrl: string): Promise<SkillInfo[]> => {
      if (!currentProject) return []
      return invoke<SkillInfo[]>('install_skill_from_github', {
        projectPath: currentProject,
        repoUrl,
      })
    },
    [currentProject],
  )

  const confirmInstall = useCallback(
    async (tempDir: string, skillNames: string[]) => {
      if (!currentProject) return
      await invoke('confirm_install_skill', {
        projectPath: currentProject,
        tempDir,
        skillNames,
      })
      await refresh()
    },
    [currentProject, refresh],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, refresh, toggle, importSkill, installFromGithub, confirmInstall }
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/hooks/useSkills.ts
git commit -m "feat(jacc): 添加 useSkills hook"
```

---

### 任务 2：InstallSkillDialog 组件

**文件：**
- 创建：`packages/jacc/src/components/dialogs/InstallSkillDialog.tsx`

- [ ] **步骤 1：创建 InstallSkillDialog.tsx**

```tsx
import { useState } from 'react'
import type { SkillInfo } from '@/hooks/useSkills'

interface InstallSkillDialogProps {
  open: boolean
  onClose: () => void
  onFetch: (repoUrl: string) => Promise<SkillInfo[]>
  onConfirm: (tempDir: string, skillNames: string[]) => Promise<void>
}

export function InstallSkillDialog({ open, onClose, onFetch, onConfirm }: InstallSkillDialogProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [available, setAvailable] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState(false)
  const [tempDir, setTempDir] = useState('')

  if (!open) return null

  async function handleFetch() {
    if (!repoUrl.trim()) return
    setFetching(true)
    setAvailable([])
    setSelected(new Set())
    try {
      const skills = await onFetch(repoUrl)
      setAvailable(skills)
      // 从 description 中提取 tempDir（格式: "tempDir|realDescription"）
      if (skills.length > 0 && skills[0].description.includes('|')) {
        const parts = skills[0].description.split('|')
        setTempDir(parts[0])
        // 修正 description
        setAvailable(
          skills.map((s) => ({
            ...s,
            description: s.description.includes('|') ? s.description.split('|').slice(1).join('|') : s.description,
          })),
        )
      }
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
        <h3 className="text-[15px] font-medium text-foreground mb-4">从 GitHub 安装</h3>

        {/* URL 输入 */}
        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">GitHub 仓库地址</div>
          <div className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="flex-1 bg-sidebar border border-border px-3 py-2 rounded-[4px] text-xs text-foreground"
            />
            <button
              onClick={handleFetch}
              disabled={fetching || !repoUrl.trim()}
              className="px-3 py-2 bg-primary text-white text-[11px] rounded-[4px] disabled:opacity-50 whitespace-nowrap"
            >
              {fetching ? '获取中...' : '获取'}
            </button>
          </div>
        </div>

        {/* Skill 列表 */}
        {available.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] text-muted mb-2">选择要安装的 skill：</div>
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

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs text-muted-foreground rounded-[4px]"
          >
            取消
          </button>
          {available.length > 0 && (
            <button
              onClick={handleInstall}
              disabled={installing || selected.size === 0}
              className="px-4 py-2 bg-success text-white text-xs rounded-[4px] disabled:opacity-50"
            >
              {installing ? '安装中...' : `安装 (${selected.size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/dialogs/InstallSkillDialog.tsx
git commit -m "feat(jacc): 添加 GitHub 安装 skill 弹窗"
```

---

### 任务 3：SkillList 通用组件

**文件：**
- 创建：`packages/jacc/src/components/SkillList.tsx`

- [ ] **步骤 1：创建 SkillList.tsx**

```tsx
import { open } from '@tauri-apps/plugin-dialog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Fab } from '@/components/Fab'
import { SourceBadge } from '@/components/SourceBadge'
import { InstallSkillDialog } from '@/components/dialogs/InstallSkillDialog'
import type { SkillInfo } from '@/hooks/useSkills'

interface SkillListProps {
  title: string
  skills: SkillInfo[]
  loading: boolean
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onImport: (sourcePath: string) => Promise<void>
  onInstallFromGithub: (repoUrl: string) => Promise<SkillInfo[]>
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
      {/* 标题 + 搜索 */}
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

      {/* 统计 */}
      <div className="flex gap-4 mb-4 text-[11px] text-muted">
        <span>共 {skills.length} 个</span>
        <span>·</span>
        <span className="text-success">{enabledCount} 已启用</span>
        <span>·</span>
        <span className="text-danger">{disabledCount} 已禁用</span>
      </div>

      {/* 列表 */}
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
                🧩
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

      {/* FAB + 菜单 */}
      <div className="fixed bottom-5 right-6">
        {showMenu && (
          <div className="absolute bottom-14 right-0 bg-card border border-border rounded-[4px] shadow-lg py-1 min-w-[140px]">
            <button
              onClick={handleImport}
              className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
            >
              📂 从本地导入
            </button>
            <button
              onClick={() => { setShowInstall(true); setShowMenu(false) }}
              className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-sidebar"
            >
              🌐 从 GitHub 安装
            </button>
          </div>
        )}
        <Fab onClick={() => setShowMenu(!showMenu)} />
      </div>

      <InstallSkillDialog
        open={showInstall}
        onClose={() => setShowInstall(false)}
        onFetch={onInstallFromGithub}
        onConfirm={onConfirmInstall}
      />
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```bash
git add packages/jacc/src/components/SkillList.tsx
git commit -m "feat(jacc): 添加通用 SkillList 组件"
```

---

### 任务 4：Skills 和 Agents 页面

**文件：**
- 创建：`packages/jacc/src/pages/Skills.tsx`
- 创建：`packages/jacc/src/pages/Agents.tsx`

- [ ] **步骤 1：创建 Skills.tsx**

```tsx
import { SkillList } from '@/components/SkillList'
import { useSkills } from '@/hooks/useSkills'

export function Skills() {
  const { skills, loading, toggle, importSkill, installFromGithub, confirmInstall } = useSkills()

  return (
    <SkillList
      title="Skills"
      skills={skills}
      loading={loading}
      onToggle={toggle}
      onImport={importSkill}
      onInstallFromGithub={installFromGithub}
      onConfirmInstall={confirmInstall}
    />
  )
}
```

- [ ] **步骤 2：创建 Agents.tsx**

```tsx
import { SkillList } from '@/components/SkillList'
import { useSkills } from '@/hooks/useSkills'

export function Agents() {
  // Agents 复用 skills 的逻辑，只是目录不同
  // TODO: 后续如果 agents 有独立逻辑可以拆分
  const { skills, loading, toggle, importSkill, installFromGithub, confirmInstall } = useSkills()

  // 过滤只显示 agents 目录下的
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
```

- [ ] **步骤 3：在 Layout.tsx 中集成**

```tsx
import { Skills } from '@/pages/Skills'
import { Agents } from '@/pages/Agents'

// 在 renderPage switch 中：
case 'skills':
  return <Skills />
case 'agents':
  return <Agents />
```

- [ ] **步骤 4：验证前端构建**

运行：`cd D:/Project/jackit/packages/jacc && pnpm build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/
git commit -m "feat(jacc): 实现 Skills 和 Agents 管理页面"
```
