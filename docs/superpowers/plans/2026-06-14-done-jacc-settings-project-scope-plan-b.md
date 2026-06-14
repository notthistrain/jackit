# settings.json 项目级编辑 + 敏感信息分流 —— Plan B：env 目录化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **前置依赖：** 本计划依赖 Plan A 已完成（`useConfig` 按 scope 读单层、`writeConfig(key, value, sensitive)` 分流、`ConfigOrigin`、`ScopeSwitcher`、EnvVars 页 scope 接入骨架）。

**目标：** 把环境变量页从「裸 key/value 输入」升级为「目录驱动」：内置 ~150 个 Claude 支持的 env 变量，新增时可搜索、分组、hover 描述、按类型输入；凭证类变量由槽位托管（置灰不可编辑）；并实现逐变量敏感分流（含密钥变量落 `settings.local.json`）。

**架构：** 新增纯数据模块 `env-catalog.ts`（变量元信息 + 搜索）；新增 `EnvVarCombobox`（搜索/分组/置灰/自定义）与 `EnvValueInput`（按 type 渲染开关/下拉/数字/文本）两个受控组件；重构 `useEnvVars` 实现逐变量分流写入；重构 EnvVars 页消费新组件并渲染槽位托管行。

**技术栈：** TypeScript/React、Vitest + Testing Library、tailwind-variants。纯数据/纯组件，无后端改动（分流复用 Plan A 的 `write_config` sensitive 参数 + 新增按 origin 读写）。

**约束：** 所有 UI 任务完成后必须用 brainstorming 视觉伴侣展示实际渲染、经用户验收后才进入下一步（设计 §6）。env-catalog 纯数据任务不强制，但其 UI 消费方需走视觉伴侣。

---

## 文件结构

**新增（`packages/jacc/src/features/env-vars/`）：**
- `api/env-catalog.ts` —— 变量元信息目录（~150 条）+ `findEnvMeta` / `searchCatalog`。纯数据，无 React。
- `api/env-catalog.test.ts` —— 目录搜索/分组/标记测试。
- `components/EnvValueInput.tsx` + `env-value-input.variants.ts` + `EnvValueInput.test.tsx` —— 按 type 渲染开关/下拉/数字/文本。
- `components/EnvVarCombobox.tsx` + `env-var-combobox.variants.ts` + `EnvVarCombobox.test.tsx` —— 可搜索、分组、hover 描述、slotManaged 置灰、允许自定义。

**修改：**
- `features/env-vars/hooks/useEnvVars.ts` —— 逐变量敏感分流（替换 Plan A 的整体非敏感写入）。
- `features/env-vars/components/EnvVarRow.tsx` —— 槽位托管行置灰（`••••（槽位托管）`、🧠 槽位、无删除）；值显示走 EnvValueInput。
- `features/env-vars/components/AddEnvVarForm.tsx` —— 内部改用 EnvVarCombobox + EnvValueInput；自定义变量提示。
- `pages/EnvVars.tsx` —— 接入新表单与槽位托管行渲染。
- `features/env-vars/index.ts` —— 导出新组件与 catalog 类型。
- `src/i18n/locales/{zh,en}.json` —— combobox/提示文案、分组名。

每个任务产出独立、可验证的变更。

> **目录数据量约束（向执行者明示）：** 设计附录 A 列出 ~150 变量、17 分组。本计划任务 1 给出**完整的类型定义 + 分组枚举 + 每组代表性条目（覆盖每种 type 与 sensitive/slotManaged 标记）**，并在文件内以分组注释占位剩余条目。执行者按附录 A 的五个文档 URL（已抓取于 2026-06-14）补全全部条目——这是**数据录入**而非逻辑实现，不算占位符缺陷。验收以「17 组齐全 + 关键敏感/槽位标记正确 + 搜索测试通过」为准，不要求逐条人工核对 150 项。

---

### 任务 1：env-catalog 数据模块

**文件：**
- 创建：`packages/jacc/src/features/env-vars/api/env-catalog.ts`
- 测试：`packages/jacc/src/features/env-vars/api/env-catalog.test.ts`

- [ ] **步骤 1：编写失败的测试**

新建 `env-catalog.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { ENV_CATALOG, findEnvMeta, searchCatalog } from './env-catalog'

describe('env-catalog', () => {
  it('covers all 17 groups', () => {
    const groups = new Set(ENV_CATALOG.map(m => m.group))
    expect(groups.size).toBe(17)
  })

  it('findEnvMeta returns meta by exact name', () => {
    const meta = findEnvMeta('ANTHROPIC_API_KEY')
    expect(meta?.sensitive).toBe(true)
  })

  it('marks slot-managed credential vars', () => {
    expect(findEnvMeta('ANTHROPIC_AUTH_TOKEN')?.slotManaged).toBe(true)
    expect(findEnvMeta('ANTHROPIC_DEFAULT_OPUS_MODEL')?.slotManaged).toBe(true)
  })

  it('does not include read-only identity vars', () => {
    expect(findEnvMeta('CLAUDECODE')).toBeUndefined()
    expect(findEnvMeta('CLAUDE_CODE_CHILD_SESSION')).toBeUndefined()
  })

  it('searchCatalog fuzzy-matches name case-insensitively', () => {
    const results = searchCatalog('token')
    expect(results.some(m => m.name === 'ANTHROPIC_AUTH_TOKEN')).toBe(true)
  })

  it('searchCatalog returns all when query empty', () => {
    expect(searchCatalog('').length).toBe(ENV_CATALOG.length)
  })

  it('boolean vars carry no enumValues; enum vars carry enumValues', () => {
    const bools = ENV_CATALOG.filter(m => m.type === 'boolean')
    expect(bools.every(m => !m.enumValues)).toBe(true)
    const enums = ENV_CATALOG.filter(m => m.type === 'enum')
    expect(enums.every(m => (m.enumValues?.length ?? 0) > 0)).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/api/env-catalog.test.ts`（在 `packages/jacc`）
预期：FAIL，模块 `./env-catalog` 不存在。

- [ ] **步骤 3：编写类型 + 分组枚举 + 头部条目**

新建 `env-catalog.ts`。先写类型、17 组枚举、搜索函数与代表性条目（覆盖每 type + 敏感/槽位标记）：

```typescript
export type EnvGroup =
  | 'auth'           // 认证凭证
  | 'endpoint'       // API 端点/网关
  | 'model'          // 模型选择
  | 'cache'          // 缓存
  | 'bedrock'        // AWS Bedrock
  | 'vertex'         // Google Vertex
  | 'foundry'        // Foundry
  | 'feature'        // 功能开关
  | 'context'        // 上下文/记忆
  | 'effort'         // Effort/思考
  | 'timeout'        // 超时/限制
  | 'proxy'          // 网络代理
  | 'tls'            // TLS 证书
  | 'telemetry'      // 遥测/隐私
  | 'ui'             // UI 显示
  | 'session'        // 会话/进程
  | 'debug'          // 调试/日志

export interface EnvVarMeta {
  name: string
  group: EnvGroup
  type: 'string' | 'boolean' | 'number' | 'enum'
  enumValues?: string[]
  description: string
  default?: string
  sensitive: boolean
  slotManaged?: boolean
  unit?: string
}

export const ENV_CATALOG: EnvVarMeta[] = [
  // ── auth 认证凭证 ──
  { name: 'ANTHROPIC_API_KEY', group: 'auth', type: 'string', sensitive: true,
    description: 'Anthropic API 密钥（X-Api-Key）。含密钥，写入项目本地 settings.local.json。' },
  { name: 'ANTHROPIC_AUTH_TOKEN', group: 'auth', type: 'string', sensitive: true, slotManaged: true,
    description: 'Bearer 鉴权 token。由模型槽位托管，请在「通用」页绑定槽位。' },
  { name: 'ANTHROPIC_CUSTOM_HEADERS', group: 'auth', type: 'string', sensitive: true,
    description: '自定义请求头（可能含凭证）。' },
  // ── endpoint API 端点/网关 ──
  { name: 'ANTHROPIC_BASE_URL', group: 'endpoint', type: 'string', sensitive: false, slotManaged: true,
    description: 'API 基础 URL。由模型槽位托管。' },
  // ── model 模型选择 ──
  { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true,
    description: 'Opus 槽位默认模型名。由槽位托管。' },
  { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true,
    description: 'Sonnet 槽位默认模型名。由槽位托管。' },
  { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true,
    description: 'Haiku 槽位默认模型名。由槽位托管。' },
  // ── feature 功能开关（boolean，写盘 0/1）──
  { name: 'DISABLE_TELEMETRY', group: 'telemetry', type: 'boolean', sensitive: false, default: '0',
    description: '关闭遥测上报。' },
  { name: 'CLAUDE_CODE_ENABLE_TELEMETRY', group: 'telemetry', type: 'boolean', sensitive: false, default: '0',
    description: '启用 OTEL 遥测。' },
  // ── effort（enum 示例）──
  { name: 'MAX_THINKING_TOKENS', group: 'effort', type: 'number', sensitive: false, unit: 'tokens',
    description: '思考预算上限。' },
  // ── timeout（number 示例，文档不一致点）──
  { name: 'CLAUDE_CODE_MAX_RETRIES', group: 'timeout', type: 'number', sensitive: false, default: '3',
    description: '请求最大重试次数。注：env-vars 文档记 3，monitoring 文档记 10，此处取 3。' },
  // ── proxy（可能含 user:pass，敏感）──
  { name: 'HTTPS_PROXY', group: 'proxy', type: 'string', sensitive: true,
    description: 'HTTPS 代理地址（可能含 user:pass，按敏感处理）。' },
  { name: 'HTTP_PROXY', group: 'proxy', type: 'string', sensitive: true,
    description: 'HTTP 代理地址（可能含 user:pass，按敏感处理）。' },
  // ── bedrock / vertex / foundry 凭证（敏感）──
  { name: 'AWS_BEARER_TOKEN_BEDROCK', group: 'bedrock', type: 'string', sensitive: true,
    description: 'Bedrock Bearer token。' },
  { name: 'GOOGLE_APPLICATION_CREDENTIALS', group: 'vertex', type: 'string', sensitive: true,
    description: 'GCP 凭证 JSON 路径。' },
  { name: 'ANTHROPIC_FOUNDRY_API_KEY', group: 'foundry', type: 'string', sensitive: true,
    description: 'Foundry API 密钥。' },
  { name: 'OTEL_EXPORTER_OTLP_HEADERS', group: 'telemetry', type: 'string', sensitive: true,
    description: 'OTLP 导出请求头（可能含 token）。' },

  // ── 以下按附录 A 五个文档 URL 补全剩余条目，保持 17 组齐全 ──
  // bedrock: CLAUDE_CODE_USE_BEDROCK(boolean), AWS_REGION(string), ANTHROPIC_BEDROCK_BASE_URL(string), ...
  // vertex: CLAUDE_CODE_USE_VERTEX(boolean), CLOUD_ML_REGION(string), ANTHROPIC_VERTEX_PROJECT_ID(string), ...
  // cache: DISABLE_PROMPT_CACHING(boolean), ...
  // context: CLAUDE_CODE_MAX_OUTPUT_TOKENS(number), ...
  // feature: DISABLE_AUTOUPDATER(boolean), DISABLE_BUG_COMMAND(boolean), DISABLE_ERROR_REPORTING(boolean),
  //          DISABLE_NON_ESSENTIAL_MODEL_CALLS(boolean), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC(boolean), ...
  // ui: FORCE_COLOR(enum: '0'|'1'|'2'|'3'), CLAUDE_CODE_DISABLE_TERMINAL_TITLE(boolean), ...
  // timeout: BASH_DEFAULT_TIMEOUT_MS(number,ms), BASH_MAX_TIMEOUT_MS(number,ms), MCP_TIMEOUT(number,ms),
  //          MCP_TOOL_TIMEOUT(number,ms), API_TIMEOUT_MS(number,ms), ...
  // tls: NODE_EXTRA_CA_CERTS(string), CLAUDE_CODE_EXTRA_BODY(string), mTLS 私钥类(sensitive:true), ...
  // telemetry: OTEL_*(各 string/enum), OTEL_METRICS_EXPORTER(enum), OTEL_LOGS_EXPORTER(enum), ...
  // session: CLAUDE_CONFIG_DIR(string), ...
  // debug: ANTHROPIC_LOG(enum), DEBUG(string), ...
]

export function findEnvMeta(name: string): EnvVarMeta | undefined {
  return ENV_CATALOG.find(m => m.name === name)
}

export function searchCatalog(query: string): EnvVarMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return ENV_CATALOG
  return ENV_CATALOG.filter(m => m.name.toLowerCase().includes(q))
}
```

> 执行者：步骤 3 只写了头部代表性条目（约 10 组）。下一步必须补全到 17 组，`covers all 17 groups` 才会通过。

- [ ] **步骤 4：补全剩余条目至 17 组**

按步骤 3 代码块内注释的分组提示与附录 A 的五个文档 URL，补全 cache / feature / context / tls / ui / session / debug 等缺失分组的条目，确保 `ENV_CATALOG` 覆盖全部 17 个 `EnvGroup`、每组 ≥1 条。字段约定：boolean 不带 `enumValues`、enum 必带 `enumValues`、含密钥或可能含密钥（API key / token / 凭证路径 / proxy / OTLP headers / mTLS 私钥）→ `sensitive: true`。这是数据录入，遵循已给字段约定即可，不要求逐条人工核对全部 ~150 项。另外，model 组应补一条 `ANTHROPIC_MODEL`（后端 `claude_settings.rs::slot_env_key` 的 fallback，非 opus/sonnet/haiku 时使用；设 `slotManaged: true` 以与前端 `MODEL_ENV_KEYS` 对齐，避免 combobox 搜不到——这超出设计 §5.5 列的 5 个 slotManaged，但与后端对齐更稳妥）。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/features/env-vars/api/env-catalog.test.ts`
预期：PASS（7 个测试）。`covers all 17 groups` 此时才应通过——若仍 FAIL，说明分组未补齐，回到步骤 4。

- [ ] **步骤 6：Commit**

```bash
git add packages/jacc/src/features/env-vars/api/env-catalog.ts \
  packages/jacc/src/features/env-vars/api/env-catalog.test.ts
git commit -m "feat(jacc): 新增 env-catalog 环境变量目录数据模块"
```

---

### 任务 2：EnvValueInput 类型化值输入组件

**文件：**
- 创建：`packages/jacc/src/features/env-vars/components/EnvValueInput.tsx`
- 创建：`packages/jacc/src/features/env-vars/components/env-value-input.variants.ts`
- 测试：`packages/jacc/src/features/env-vars/components/EnvValueInput.test.tsx`

> **UI 任务：完成后用视觉伴侣展示四种输入形态，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `EnvValueInput.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnvValueInput } from './EnvValueInput'

describe('envValueInput', () => {
  it('boolean renders a toggle writing 1/0', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EnvValueInput type="boolean" value="0" onChange={onChange} />)
    await user.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('boolean shows on/off label with value', () => {
    render(<EnvValueInput type="boolean" value="1" onChange={vi.fn()} />)
    expect(screen.getByText(/1/)).toBeTruthy()
  })

  it('enum renders a select limited to enumValues', () => {
    render(<EnvValueInput type="enum" value="0" enumValues={['0', '1', '2']} onChange={vi.fn()} />)
    const opts = screen.getAllByRole('option')
    expect(opts.map(o => (o as HTMLOptionElement).value)).toEqual(['0', '1', '2'])
  })

  it('number renders a number input', () => {
    render(<EnvValueInput type="number" value="3" onChange={vi.fn()} />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3')
  })

  it('string renders a text input', () => {
    render(<EnvValueInput type="string" value="x" onChange={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('x')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/components/EnvValueInput.test.tsx`
预期：FAIL，模块不存在。

- [ ] **步骤 3：编写 variants**

新建 `env-value-input.variants.ts`：

```typescript
import { tv } from 'tailwind-variants'

export const envValueInput = tv({
  slots: {
    text: 'w-[90%] bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    select: 'bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] text-foreground',
    toggle: 'relative inline-flex items-center h-4 w-7 rounded-full transition-colors',
    toggleLabel: 'ml-2 text-[11px] text-muted-foreground',
    knob: 'inline-block h-3 w-3 rounded-full bg-white transition-transform',
  },
  variants: {
    on: {
      true: { toggle: 'bg-success', knob: 'translate-x-3.5' },
      false: { toggle: 'bg-border', knob: 'translate-x-0.5' },
    },
  },
})
```

- [ ] **步骤 4：编写组件**

新建 `EnvValueInput.tsx`（命名导出 + 导出 Props，JSX < 50 行）：

```tsx
import { envValueInput } from './env-value-input.variants'

export interface EnvValueInputProps {
  type: 'string' | 'boolean' | 'number' | 'enum'
  value: string
  enumValues?: string[]
  default?: string
  unit?: string
  onChange: (value: string) => void
  className?: string
}

export function EnvValueInput({ type, value, enumValues, default: def, unit, onChange }: EnvValueInputProps) {
  const on = value === '1'
  const { text, select, toggle, toggleLabel, knob } = envValueInput({ on })

  if (type === 'boolean') {
    return (
      <div className="flex items-center">
        <button type="button" aria-pressed={on} onClick={() => onChange(on ? '0' : '1')} className={toggle()}>
          <span className={knob()} />
        </button>
        <span className={toggleLabel()}>{on ? `已开启(1)` : `已关闭(0)`}{def ? ` · 默认 ${def}` : ''}</span>
      </div>
    )
  }

  if (type === 'enum') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={select()}>
        {(enumValues ?? []).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    )
  }

  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={[def && `默认 ${def}`, unit].filter(Boolean).join(' · ')}
      className={text()}
    />
  )
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/features/env-vars/components/EnvValueInput.test.tsx`
预期：PASS（5 个测试）。

- [ ] **步骤 6：视觉伴侣验收 + Commit**

视觉伴侣展示 boolean 开关 / enum 下拉 / number / string 四态，经用户验收后：

```bash
git add packages/jacc/src/features/env-vars/components/EnvValueInput.tsx \
  packages/jacc/src/features/env-vars/components/env-value-input.variants.ts \
  packages/jacc/src/features/env-vars/components/EnvValueInput.test.tsx
git commit -m "feat(jacc): 新增 EnvValueInput 类型化值输入组件"
```

---

### 任务 3：EnvVarCombobox 可搜索分组组件

**文件：**
- 创建：`packages/jacc/src/features/env-vars/components/EnvVarCombobox.tsx`
- 创建：`packages/jacc/src/features/env-vars/components/env-var-combobox.variants.ts`
- 测试：`packages/jacc/src/features/env-vars/components/EnvVarCombobox.test.tsx`

> **UI 任务：完成后用视觉伴侣展示搜索/分组/hover 描述/置灰/自定义，经用户验收。**

- [ ] **步骤 1：编写失败的测试**

新建 `EnvVarCombobox.test.tsx`：

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EnvVarCombobox } from './EnvVarCombobox'

describe('envVarCombobox', () => {
  it('filters options by query', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'token')
    expect(screen.getByText('ANTHROPIC_AUTH_TOKEN')).toBeTruthy()
    expect(screen.queryByText('HTTPS_PROXY')).toBeNull()
  })

  it('renders group headers', async () => {
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'anthropic')
    // 分组标题出现（认证凭证组）
    expect(screen.getByText('认证凭证')).toBeTruthy()
  })

  it('slotManaged option is disabled and not selectable', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'AUTH_TOKEN')
    const opt = screen.getByText('ANTHROPIC_AUTH_TOKEN').closest('[data-disabled]')
    expect(opt?.getAttribute('data-disabled')).toBe('true')
    await user.click(screen.getByText('ANTHROPIC_AUTH_TOKEN'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selecting a catalog option calls onSelect with meta', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'API_KEY')
    await user.click(screen.getByText('ANTHROPIC_API_KEY'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'ANTHROPIC_API_KEY', sensitive: true }))
  })

  it('allows custom value not in catalog', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EnvVarCombobox value="" onSelect={onSelect} />)
    await user.type(screen.getByRole('textbox'), 'MY_CUSTOM_VAR')
    await user.click(screen.getByText(/MY_CUSTOM_VAR/))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'MY_CUSTOM_VAR', sensitive: false }))
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/components/EnvVarCombobox.test.tsx`
预期：FAIL，模块不存在。

- [ ] **步骤 3：编写 variants + 分组标签**

新建 `env-var-combobox.variants.ts`：

```typescript
import { tv } from 'tailwind-variants'

export const envVarCombobox = tv({
  slots: {
    root: 'relative',
    input: 'w-full bg-sidebar border border-border px-2 py-1 rounded-[2px] text-[11px] font-mono text-foreground',
    dropdown: 'absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-card border border-border rounded-[4px] shadow-md',
    groupTitle: 'px-2 py-1 text-[10px] text-muted-foreground bg-sidebar sticky top-0',
    option: 'flex items-center justify-between px-2 py-1 text-[11px] font-mono cursor-pointer hover:bg-sidebar',
    optionName: 'truncate',
    optionHint: 'ml-2 text-[9px] text-muted-foreground shrink-0',
    custom: 'px-2 py-1 text-[11px] text-primary cursor-pointer hover:bg-sidebar',
  },
  variants: {
    disabled: {
      true: { option: 'opacity-50 cursor-not-allowed hover:bg-transparent' },
    },
  },
})
```

分组标签在组件内用 map（也可放 i18n，本计划内联中文 + 英文走 i18n key `envgroup.<group>`）：

```typescript
// 组件文件内
const GROUP_ORDER: EnvGroup[] = ['auth', 'endpoint', 'model', 'cache', 'bedrock', 'vertex',
  'foundry', 'feature', 'context', 'effort', 'timeout', 'proxy', 'tls', 'telemetry', 'ui', 'session', 'debug']
```

i18n 新增 17 个 `envgroup.*` 键（zh/en 各一份），如 `"envgroup.auth": "认证凭证"` / `"Auth credentials"` …（执行者按 §附录 A 的 17 组中文名补全；测试断言用了「认证凭证」）。

- [ ] **步骤 4：编写组件**

新建 `EnvVarCombobox.tsx`。`onSelect` 回传 `EnvVarMeta`（自定义变量构造 `{ name, group:'feature', type:'string', sensitive:false, description:'' }` 兜底）。组件 < 300 行、JSX < 50 行（拆 `renderGroup` 辅助）：

```tsx
import { useMemo, useState } from 'react'
import { useT } from '@/i18n'
import type { EnvGroup, EnvVarMeta } from '../api/env-catalog'
import { searchCatalog } from '../api/env-catalog'
import { envVarCombobox } from './env-var-combobox.variants'

export interface EnvVarComboboxProps {
  value: string
  onSelect: (meta: EnvVarMeta) => void
  className?: string
}

const GROUP_ORDER: EnvGroup[] = ['auth', 'endpoint', 'model', 'cache', 'bedrock', 'vertex',
  'foundry', 'feature', 'context', 'effort', 'timeout', 'proxy', 'tls', 'telemetry', 'ui', 'session', 'debug']

export function EnvVarCombobox({ value, onSelect }: EnvVarComboboxProps) {
  const { t } = useT()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const { root, input, dropdown, groupTitle, option, optionName, optionHint, custom } = envVarCombobox()

  const results = useMemo(() => searchCatalog(query), [query])
  const exact = results.some(m => m.name === query.trim())
  const grouped = useMemo(() => {
    const map = new Map<EnvGroup, EnvVarMeta[]>()
    for (const m of results) {
      const arr = map.get(m.group) ?? []
      arr.push(m)
      map.set(m.group, arr)
    }
    return GROUP_ORDER.filter(g => map.has(g)).map(g => [g, map.get(g)!] as const)
  }, [results])

  function pick(meta: EnvVarMeta) {
    if (meta.slotManaged) return
    onSelect(meta)
    setOpen(false)
  }

  return (
    <div className={root()}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('envvars.add.searchPlaceholder')}
        className={input()}
      />
      {open && (
        <div className={dropdown()}>
          {grouped.map(([group, metas]) => (
            <div key={group}>
              <div className={groupTitle()}>{t(`envgroup.${group}`)}</div>
              {metas.map(meta => (
                <div
                  key={meta.name}
                  data-disabled={!!meta.slotManaged}
                  title={meta.description + (meta.sensitive ? ' · 含密钥将写入 settings.local.json' : '')}
                  onClick={() => pick(meta)}
                  className={envVarCombobox({ disabled: !!meta.slotManaged }).option()}
                >
                  <span className={optionName()}>{meta.name}</span>
                  <span className={optionHint()}>
                    {meta.slotManaged ? t('envvars.add.slotManaged') : meta.sensitive ? '🔒' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {query.trim() && !exact && (
            <div
              className={custom()}
              onClick={() => { onSelect({ name: query.trim(), group: 'feature', type: 'string', sensitive: false, description: '' }); setOpen(false) }}
            >
              {t('envvars.add.useCustom', { name: query.trim() })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

i18n 新增：
- `envvars.add.searchPlaceholder`：「搜索或输入变量名…」/「Search or type a variable…」
- `envvars.add.slotManaged`：「🧠 由槽位管理」/「🧠 Slot-managed」
- `envvars.add.useCustom`：「使用自定义变量「{name}」（不会自动判定敏感，含密钥请确认）」/「Use custom "{name}" (sensitivity not auto-detected)」

> 测试 `data-disabled` + `closest('[data-disabled]')`：因 option div 自带该属性，`closest` 命中自身。`useCustom` 文案含 name，测试用正则 `/MY_CUSTOM_VAR/` 匹配。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run src/features/env-vars/components/EnvVarCombobox.test.tsx`
预期：PASS（5 个测试）。

- [ ] **步骤 6：视觉伴侣验收 + Commit**

视觉伴侣展示搜索过滤、分组标题、slotManaged 置灰、🔒 敏感标、自定义项，经用户验收后：

```bash
git add packages/jacc/src/features/env-vars/components/EnvVarCombobox.tsx \
  packages/jacc/src/features/env-vars/components/env-var-combobox.variants.ts \
  packages/jacc/src/features/env-vars/components/EnvVarCombobox.test.tsx \
  packages/jacc/src/i18n/locales/zh.json packages/jacc/src/i18n/locales/en.json
git commit -m "feat(jacc): 新增 EnvVarCombobox 可搜索分组组件"
```

---

### 任务 4：useEnvVars 逐变量敏感分流

**背景：** Plan A 中 `useEnvVars` 把整个 `env` 对象作为单一 key 非敏感写入（落 `settings.json`）。本任务实现逐变量分流：含密钥变量（catalog `sensitive=true`）单独落 `settings.local.json`，非敏感落 `settings.json`。

**分流策略（关键设计，已修正）：** 一个看似可行但**错误**的方案是「前端把 env 拆 sharedEnv/localEnv，各以不同 sensitive 写 `env` key」。它行不通——Plan A 的 `read_layer_at` 按**顶层 key** 合并，local 的 `env` 会整体覆盖 shared 的 `env`，读回时丢失非敏感变量；且 `env` 作为单 key 只能有一个 origin，无法表达「env 内部分属两文件」。

正确方案：**新增后端按 env 子键分流的命令**（授权来源：Plan A 任务 15 的约束注释明文写道「届时需扩展后端按 env 子键分流，或前端按 origin 分别 read-modify-write」——本计划选择前者；设计 §4.4/§8 未直接列此后端命令，属 Plan A→Plan B 的衔接授权，非 §4.4 授权）。env 页不再走通用 `useConfig` 的 env 路径，改用三个专用命令：
- `read_env_layer(scope, project_path)` → `{ vars: [{ key, value, origin }] }`：项目 scope 下分别读 `settings.json` 与 `settings.local.json` 的 `env` 子对象，按变量标 `shared`/`local`（local 同名覆盖 shared）；全局 scope 读 `~/.claude/settings.json` 的 env，origin 全 `global`。
- `set_env_var(scope, project_path, key, value, sensitive)`：项目+敏感→改写 `settings.local.json` 的 `env[key]`（+gitignore）；项目+非敏感→改写 `settings.json` 的 `env[key]`；全局→改写全局 env。子对象级 read-modify-write，不动 env 内其它键。
- `delete_env_var(scope, project_path, key, origin)`：按 origin 删对应文件 env 内的该键。

本任务（任务 4）先做后端三命令；任务 5 改 `useEnvVars` 消费它们。

**文件：**
- 修改：`packages/jacc/src-tauri/src/claude_settings.rs` —— 新增 `write_env_kv` / `delete_env_kv`（env 子对象级原子读改写，复用 `update()`）。
- 修改：`packages/jacc/src-tauri/src/commands/config.rs` —— 新增 `EnvVarItem`/`EnvLayer`、`read_env_layer`、`set_env_var`、`delete_env_var`。
- 修改：`packages/jacc/src-tauri/src/lib.rs` —— 注册三命令。
- 测试：`claude_settings.rs` 与 `config.rs` 的 `mod tests`。

- [ ] **步骤 1：编写失败的测试（claude_settings env helper）**

在 `claude_settings.rs` `mod tests` 追加：

```rust
#[tokio::test]
async fn write_env_kv_merges_without_clobbering_siblings() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    write_env_kv(&path, "FOO", serde_json::json!("1")).await.unwrap();
    write_env_kv(&path, "BAR", serde_json::json!("2")).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(v["env"]["FOO"], "1");
    assert_eq!(v["env"]["BAR"], "2");
}

#[tokio::test]
async fn delete_env_kv_removes_only_target() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    write_env_kv(&path, "FOO", serde_json::json!("1")).await.unwrap();
    write_env_kv(&path, "BAR", serde_json::json!("2")).await.unwrap();
    delete_env_kv(&path, "FOO").await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert!(v["env"].get("FOO").is_none());
    assert_eq!(v["env"]["BAR"], "2");
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cargo test -p jacc claude_settings::tests::write_env_kv -- --nocapture`
预期：FAIL，`cannot find function write_env_kv` / `delete_env_kv`。

- [ ] **步骤 3：编写 env helper（claude_settings.rs）**

在 `claude_settings.rs` 的 `write_kv`（约 line 134）附近新增（复用 `update()` 的 SETTINGS_LOCK + 原子写）：

```rust
/// 写入 env 子对象内单个键，不影响 env 内其它键与顶层其它 key。
pub async fn write_env_kv(path: &Path, key: &str, value: serde_json::Value) -> AppResult<()> {
    update(path, |obj| {
        let env = obj.entry("env").or_insert_with(|| serde_json::json!({}));
        let env_obj = env
            .as_object_mut()
            .ok_or_else(|| AppError::Custom("settings.env 不是对象".to_string()))?;
        env_obj.insert(key.to_string(), value);
        Ok(())
    })
    .await
}

/// 删除 env 子对象内单个键。
pub async fn delete_env_kv(path: &Path, key: &str) -> AppResult<()> {
    update(path, |obj| {
        if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
            env.remove(key);
        }
        Ok(())
    })
    .await
}
```

> `AppError` 在 claude_settings.rs 是否已导入：核实文件顶部 `use crate::error::{AppError, AppResult}` 或 `AppResult`。若仅导入 `AppResult`，把 `AppError::Custom` 写全路径 `crate::error::AppError::Custom`。

- [ ] **步骤 4：运行测试验证通过**

运行：`cargo test -p jacc claude_settings::tests -- --nocapture`
预期：PASS（含 2 个新 env helper 测试）。

- [ ] **步骤 5：编写 config.rs env 命令测试**

在 config.rs `mod tests` 追加（Plan A 任务 3/4 已新建该 `#[cfg(test)] mod tests` 模块，此处直接追加；若执行时该模块不存在则按 Plan A T3 范式在文件末尾新建）；测可抽出的 `read_env_layer_at`：

```rust
#[tokio::test]
async fn env_layer_marks_origin_per_var() {
    let dir = tempfile::tempdir().unwrap();
    let shared = dir.path().join("settings.json");
    std::fs::write(&shared, r#"{"env":{"A":"1","B":"2"}}"#).unwrap();
    let local = dir.path().join("settings.local.json");
    std::fs::write(&local, r#"{"env":{"B":"9","C":"3"}}"#).unwrap();
    let layer = read_env_layer_at(&shared, Some(&local)).await.unwrap();
    let get = |k: &str| layer.vars.iter().find(|v| v.key == k).unwrap();
    assert!(matches!(get("A").origin, ConfigOrigin::Shared));
    assert_eq!(get("B").value, serde_json::json!("9"));
    assert!(matches!(get("B").origin, ConfigOrigin::Local));
    assert!(matches!(get("C").origin, ConfigOrigin::Local));
}
```

- [ ] **步骤 6：编写 config.rs env 命令实现**

在 config.rs 新增（`ConfigOrigin` 已在 Plan A 定义）：

```rust
#[derive(Debug, Serialize)]
pub struct EnvVarItem {
    pub key: String,
    pub value: serde_json::Value,
    pub origin: ConfigOrigin,
}

#[derive(Debug, Serialize)]
pub struct EnvLayer {
    pub vars: Vec<EnvVarItem>,
}

fn env_of(value: &serde_json::Value) -> Vec<(String, serde_json::Value)> {
    value
        .get("env")
        .and_then(|e| e.as_object())
        .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

async fn read_env_layer_at(shared: &Path, local: Option<&Path>) -> AppResult<EnvLayer> {
    let shared_val = crate::claude_settings::read(shared).await?;
    let mut vars: Vec<EnvVarItem> = env_of(&shared_val)
        .into_iter()
        .map(|(key, value)| EnvVarItem { key, value, origin: ConfigOrigin::Shared })
        .collect();
    if let Some(local_path) = local {
        let local_val = crate::claude_settings::read(local_path).await?;
        for (key, value) in env_of(&local_val) {
            if let Some(item) = vars.iter_mut().find(|i| i.key == key) {
                item.value = value;
                item.origin = ConfigOrigin::Local;
            } else {
                vars.push(EnvVarItem { key, value, origin: ConfigOrigin::Local });
            }
        }
    }
    Ok(EnvLayer { vars })
}

#[tauri::command]
pub async fn read_env_layer(scope: ConfigScope, project_path: Option<String>) -> AppResult<EnvLayer> {
    log_read_command!("read_env_layer", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                let mut layer = read_env_layer_at(&path, None).await?;
                for v in layer.vars.iter_mut() { v.origin = ConfigOrigin::Global; }
                Ok(layer)
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| crate::error::AppError::Custom("项目路径不能为空".to_string()))?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                let shared = crate::claude_settings::project_settings_path(&validated);
                let local = crate::claude_settings::project_local_settings_path(&validated);
                read_env_layer_at(&shared, Some(&local)).await
            }
        }
    })
}

#[tauri::command]
pub async fn set_env_var(
    scope: ConfigScope, project_path: Option<String>,
    key: String, value: serde_json::Value, sensitive: bool,
) -> AppResult<WriteConfigResult> {
    log_command!("set_env_var", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                crate::claude_settings::write_env_kv(&path, &key, value).await?;
                Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| crate::error::AppError::Custom("项目路径不能为空".to_string()))?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                if sensitive {
                    let local = crate::claude_settings::project_local_settings_path(&validated);
                    crate::claude_settings::write_env_kv(&local, &key, value).await?;
                    let gitignore_updated = crate::claude_settings::ensure_local_settings_gitignored(&validated)?;
                    Ok(WriteConfigResult { wrote_local: true, gitignore_updated })
                } else {
                    let shared = crate::claude_settings::project_settings_path(&validated);
                    crate::claude_settings::write_env_kv(&shared, &key, value).await?;
                    Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
                }
            }
        }
    })
}

#[tauri::command]
pub async fn delete_env_var(
    scope: ConfigScope, project_path: Option<String>, key: String, origin: ConfigOrigin,
) -> AppResult<()> {
    log_command!("delete_env_var", {
        let path = match scope {
            ConfigScope::Global => crate::claude_settings::global_settings_path(),
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| crate::error::AppError::Custom("项目路径不能为空".to_string()))?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                match origin {
                    ConfigOrigin::Local => crate::claude_settings::project_local_settings_path(&validated),
                    _ => crate::claude_settings::project_settings_path(&validated),
                }
            }
        };
        crate::claude_settings::delete_env_kv(&path, &key).await
    })
}
```

- [ ] **步骤 7：注册命令、验证、Commit**

`lib.rs` 在 config 区块加：

```rust
        commands::config::read_env_layer,
        commands::config::set_env_var,
        commands::config::delete_env_var,
```

运行：`cargo test -p jacc config::tests -- --nocapture` 与 `cargo clippy -- -D warnings`，预期 PASS。

```bash
git add packages/jacc/src-tauri/src/claude_settings.rs \
  packages/jacc/src-tauri/src/commands/config.rs packages/jacc/src-tauri/src/lib.rs
git commit -m "feat(jacc): 后端 env 子键分流命令 read_env_layer/set_env_var/delete_env_var"
```

---

### 任务 5：useEnvVars 改用 env 子键命令 + 目录元信息

**文件：**
- 修改：`packages/jacc/src/features/env-vars/hooks/useEnvVars.ts`
- 修改：`packages/jacc/src/features/env-vars/hooks/useEnvVars.test.ts`

- [ ] **步骤 1：编写失败的测试**

重写 `useEnvVars.test.ts`（mock invoke + store），断言读 `read_env_layer`、写 `set_env_var` 带 catalog 的 sensitive：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  store: { configScope: 'project' as 'global' | 'project', currentProject: '/proj' as string | null },
  success: vi.fn(), error: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => mocks.store }))
vi.mock('@/providers/ToastProvider', () => ({ useToast: () => ({ success: mocks.success, error: mocks.error }) }))

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.store.configScope = 'project'; mocks.store.currentProject = '/proj'
})

describe('useEnvVars per-var routing', () => {
  it('reads env layer on mount', async () => {
    mocks.invoke.mockResolvedValue({ vars: [{ key: 'FOO', value: 'bar', origin: 'shared' }] })
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await waitFor(() => expect(result.current.entries.length).toBe(1))
    expect(mocks.invoke).toHaveBeenCalledWith('read_env_layer', { scope: 'project', projectPath: '/proj' })
  })

  it('add a known sensitive var routes sensitive=true', async () => {
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'set_env_var' ? Promise.resolve({ wrote_local: true, gitignore_updated: false })
        : Promise.resolve({ vars: [] }))
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => { await result.current.setVar('ANTHROPIC_API_KEY', 'sk-x') })
    expect(mocks.invoke).toHaveBeenCalledWith('set_env_var', {
      scope: 'project', projectPath: '/proj', key: 'ANTHROPIC_API_KEY', value: 'sk-x', sensitive: true,
    })
  })

  it('add a custom var routes sensitive=false', async () => {
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === 'set_env_var' ? Promise.resolve({ wrote_local: false, gitignore_updated: false })
        : Promise.resolve({ vars: [] }))
    const { useEnvVars } = await import('./useEnvVars')
    const { result } = renderHook(() => useEnvVars())
    await act(async () => { await result.current.setVar('MY_CUSTOM', 'v') })
    expect(mocks.invoke).toHaveBeenCalledWith('set_env_var',
      expect.objectContaining({ key: 'MY_CUSTOM', sensitive: false }))
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/hooks/useEnvVars.test.ts`
预期：FAIL —— 旧 hook 走 `useConfig`/`write_config`，无 `read_env_layer`/`setVar`。

- [ ] **步骤 3：编写实现代码**

重写 `useEnvVars.ts`，直接 invoke env 命令，sensitive 取自 catalog（`findEnvMeta`），槽位托管变量从可编辑列表过滤但仍展示：

> **前置核对（跨计划衔接，避免 tsc 报 `Module has no exported member 'ConfigOrigin'`）：** 下方代码 `import type { ConfigOrigin } from '@/shared/hooks/useConfig'` 依赖 Plan A 任务 9 已在 `useConfig.ts` 导出 `ConfigOrigin`（plan-a T9 代码确有 `export type ConfigOrigin = 'global' | 'shared' | 'local'`）。实现前先确认该导出：若存在则照用；若 Plan A 实际把它落在 `env-vars-api.ts` 等别处则改 import 路径；若未导出则在本文件顶部 `type ConfigOrigin = 'global' | 'shared' | 'local'` 兜底。`MODEL_ENV_KEYS` 已在现有 `env-vars-api.ts:3-10` 导出，无需核对。

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/providers/ToastProvider'
import { useAppStore } from '@/stores/useAppStore'
import type { ConfigOrigin } from '@/shared/hooks/useConfig'
import { findEnvMeta } from '../api/env-catalog'
import { MODEL_ENV_KEYS } from '../api/env-vars-api'

export interface EnvEntry { key: string, value: string, origin: ConfigOrigin }
interface EnvLayer { vars: EnvEntry[] }
interface WriteResult { wrote_local: boolean, gitignore_updated: boolean }

export function useEnvVars() {
  const { configScope, currentProject } = useAppStore()
  const [entries, setEntries] = useState<EnvEntry[]>([])
  const { success, error } = useToast()
  const { t } = useT()
  const needsProject = configScope === 'project' && !currentProject

  const refresh = useCallback(async () => {
    if (needsProject) { setEntries([]); return }
    try {
      const layer = await invoke<EnvLayer>('read_env_layer', { scope: configScope, projectPath: currentProject })
      setEntries(layer.vars.map(v => ({ ...v, value: String(v.value) })))
    } catch (e) { error(String(e)) }
  }, [configScope, currentProject, needsProject, error])

  const setVar = useCallback(async (key: string, value: string) => {
    const sensitive = findEnvMeta(key)?.sensitive ?? false
    const res = await invoke<WriteResult>('set_env_var', {
      scope: configScope, projectPath: currentProject, key, value, sensitive,
    })
    if (res.wrote_local) success(t('config.wroteLocal'))
    await refresh()
  }, [configScope, currentProject, refresh, success, t])

  const remove = useCallback(async (key: string, origin: ConfigOrigin) => {
    await invoke('delete_env_var', { scope: configScope, projectPath: currentProject, key, origin })
    await refresh()
  }, [configScope, currentProject, refresh])

  useEffect(() => { refresh() }, [refresh])

  // 槽位托管变量（由「通用」页槽位写入）：展示但不可在此编辑
  const modelKeys = MODEL_ENV_KEYS as readonly string[]
  const regularEntries = entries.filter(e => !modelKeys.includes(e.key))
  const modelEntries = entries.filter(e => modelKeys.includes(e.key))

  return { entries, regularEntries, modelEntries, needsProject, refresh, setVar, remove }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run src/features/env-vars/hooks/useEnvVars.test.ts`
预期：PASS（3 个测试）。

- [ ] **步骤 5：Commit**

```bash
git add packages/jacc/src/features/env-vars/hooks/useEnvVars.ts \
  packages/jacc/src/features/env-vars/hooks/useEnvVars.test.ts
git commit -m "feat(jacc): useEnvVars 逐变量敏感分流（read_env_layer/set_env_var）"
```

---

### 任务 6：EnvVarRow 槽位托管行 + EnvVars 页接入新表单

**背景：** 槽位托管变量整行置灰、值显 `••••（槽位托管）`、来源标「🧠 槽位」、无删除、不可编辑（设计 §3.3）。AddEnvVarForm 改用 EnvVarCombobox + EnvValueInput。EnvVars 页消费新 `useEnvVars` 接口（`setVar`/`remove(key, origin)`）。

**文件：**
- 修改：`packages/jacc/src/features/env-vars/components/EnvVarRow.tsx`（+ variants + test）
- 修改：`packages/jacc/src/features/env-vars/components/AddEnvVarForm.tsx`（+ variants + test）
- 修改：`packages/jacc/src/pages/EnvVars.tsx`（+ test）
- 修改：`packages/jacc/src/features/env-vars/index.ts`

> **UI 任务：完成后用视觉伴侣展示槽位托管置灰行、新增表单（combobox+类型输入）、敏感落盘 toast，经用户验收。**

- [ ] **步骤 1：编写失败的测试（EnvVarRow 槽位托管行）+ 迁移现有回调用例**

`EnvVarRow.test.tsx` 现有用例（Plan A 任务 12 已把 props 改名为 origin/showSource，但回调仍是 `onLocalChange`/`onBlur`/`onDelete(key)`）需随本任务的接口变更迁移：
- `calls onLocalChange when input changes` 与 `calls onBlur when input loses focus` 两用例 → 合并/重写为 **`calls onCommit when value changes`**：渲染传 `meta={{ name:'MY_VAR', group:'feature', type:'string', sensitive:false, description:'' }} onCommit={fn}`，改 input 值后断言 `fn` 收到 `('MY_VAR', <新值>)`。（值输入现由 `EnvValueInput` 承担，string 类型渲染为 textbox。）
- `calls onDelete when delete button clicked` → 删除回调签名变 `(key, origin)`：断言 `onDelete` 收到 `('MY_VAR', 'global')`（渲染传 `origin="global"`）。
- 其余 readOnly 用例不变。

再追加槽位托管行用例：

```tsx
it('renders slot-managed row greyed with masked value and no delete', () => {
  render(<EnvVarRow envKey="ANTHROPIC_AUTH_TOKEN" value="sk-x" origin="local" slotManaged t={(k: string) => k} />)
  // 断言掩码 ••••（稳定，不依赖 i18n 文案）。mock t 原样返回 key，故不能断言「槽位托管」中文
  expect(screen.getByText(/••••/)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull() // 无删除按钮
  expect(screen.queryByDisplayValue('sk-x')).toBeNull() // 不显示真实值
})
```

> 断言用掩码 `••••`：值单元格渲染 `•••• {t('envvars.managedByModels')}`，mock `t` 原样返回 key（得 `•••• envvars.managedByModels`），故只能断言固定前缀 `••••`，不能断言中文「槽位托管」。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run src/features/env-vars/components/EnvVarRow.test.tsx`
预期：FAIL —— `slotManaged` prop 不存在、无掩码渲染。

- [ ] **步骤 3：改 EnvVarRow（槽位托管行 + 类型化值）**

`EnvVarRow.tsx` 改动：(a) Props 加 `slotManaged?: boolean` 与可选 `meta`（catalog `EnvVarMeta`，用于决定值输入 type）；(b) 槽位托管时整行置灰、值显 `••••（槽位托管）`、来源 `<SourceBadge scope="local" />` 旁加 🧠、不渲染删除按钮、不渲染输入；(c) 非托管且非 readOnly 时值改用 `EnvValueInput`（type 取 `meta?.type ?? 'string'`），通过 `onLocalChange`/`onBlur` 改为单一 `onCommit(key, value)`（与新 `useEnvVars.setVar` 对接）。

Props 改为：

```tsx
import type { EnvVarMeta } from '../api/env-catalog'
import type { ConfigOrigin } from '@/shared/hooks/useConfig'
import { EnvValueInput } from './EnvValueInput'
import { SourceBadge } from '@/shared/components/ui/SourceBadge'
import { envVarRowVariants } from './env-var-row.variants'

export interface EnvVarRowProps {
  envKey: string
  value: string
  origin: ConfigOrigin | 'models'
  showSource?: boolean
  readOnly?: boolean      // model 行（🧠 由槽位写入，旧 modelEntries）
  slotManaged?: boolean   // catalog 标记的槽位托管变量
  meta?: EnvVarMeta
  onCommit?: (key: string, value: string) => void
  onDelete?: (key: string, origin: ConfigOrigin) => void
  t: (key: string, params?: Record<string, string>) => string
}
```

值单元格逻辑（替换原 line 34-47 区域）：

```tsx
      <div className={valueCell()}>
        {readOnly || slotManaged
          ? <div className={managedHint()}>•••• {t('envvars.managedByModels')}</div>
          : (
              <EnvValueInput
                type={meta?.type ?? 'string'}
                value={value}
                enumValues={meta?.enumValues}
                default={meta?.default}
                unit={meta?.unit}
                onChange={v => onCommit?.(envKey, v)}
              />
            )}
      </div>
```

来源/删除单元格：`showSource` 时渲染 `<SourceBadge scope={origin} />`（`origin: ConfigOrigin | 'models'`，SourceBadge 的 scope 联合类型已含 `'models'`，无需三元），slotManaged 额外前置 🧠；删除按钮仅 `!readOnly && !slotManaged && origin !== 'models'` 时渲染，`onClick={() => onDelete?.(envKey, origin as ConfigOrigin)}`。

- [ ] **步骤 4：改 AddEnvVarForm（combobox + 类型化输入）**

`AddEnvVarForm` 重构：`values` 改为 `{ meta: EnvVarMeta | null, value: string }`。名称输入换成 `<EnvVarCombobox value={values.meta?.name ?? ''} onSelect={meta => onChange({ meta, value: '' })} />`；值输入换成 `<EnvValueInput type={values.meta?.type ?? 'string'} value={values.value} enumValues={values.meta?.enumValues} default={values.meta?.default} onChange={value => onChange({ ...values, value })} />`；提交时把 `values.meta.name` 与 `values.value` 交给页面。自定义变量（meta.sensitive=false 且非 catalog）由 combobox 的 useCustom 分支构造 meta。

- [ ] **步骤 5：改 EnvVars.tsx 接入新接口**

`EnvVars.tsx` 改动：从 `useEnvVars()` 解构 `{ regularEntries, modelEntries, needsProject, setVar, remove }`（替换旧 `add/update/scope`）。`AddEnvVarForm` 的提交 handler 调 `setVar(meta.name, value)`。`regularEntries` 每行 `EnvVarRow` 传 `origin={e.origin} showSource={configScope === 'project'} meta={findEnvMeta(e.key)} slotManaged={findEnvMeta(e.key)?.slotManaged} onCommit={(k, v) => setVar(k, v)} onDelete={remove}`。`modelEntries` 行传 `readOnly origin="models"`。导入 `findEnvMeta`。

> 说明：所有 slotManaged 目录变量（`ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL`/`ANTHROPIC_DEFAULT_*_MODEL`）都在 `MODEL_ENV_KEYS` 内，已在任务 5 被分流进 `modelEntries`（readOnly 行渲染、置灰），不会落入 `regularEntries`。因此 regularEntries 行上的 `slotManaged` prop 实际恒为 falsy——保留它是防御性的（万一目录新增不在 MODEL_ENV_KEYS 的 slotManaged 变量）。slotManaged 真正起作用的地方是 `EnvVarCombobox`（任务 3，置灰不可选）。EnvVarRow 的 `slotManaged` 渲染分支主要由其单元测试（任务 6 步骤 1）覆盖。

- [ ] **步骤 6：更新 index.ts 导出**

`features/env-vars/index.ts` 追加：

```typescript
export { EnvValueInput } from './components/EnvValueInput'
export type { EnvValueInputProps } from './components/EnvValueInput'
export { EnvVarCombobox } from './components/EnvVarCombobox'
export type { EnvVarComboboxProps } from './components/EnvVarCombobox'
export { ENV_CATALOG, findEnvMeta, searchCatalog } from './api/env-catalog'
export type { EnvVarMeta, EnvGroup } from './api/env-catalog'
```

- [ ] **步骤 7：运行测试验证通过**

运行：`npx vitest run src/features/env-vars src/pages/EnvVars.test.tsx`
预期：PASS。注意更新 `EnvVars.test.tsx`（Plan A 任务 15 建的）使其 mock `useEnvVars` 返回新接口（`setVar`/`remove`），并补 `findEnvMeta` 不被 mock（用真实 catalog）。

- [ ] **步骤 8：视觉伴侣验收 + Commit**

视觉伴侣展示：槽位托管置灰行、combobox 新增（搜索/分组/置灰/自定义）、类型化值输入、敏感变量落盘 toast，经用户验收后：

```bash
git add packages/jacc/src/features/env-vars packages/jacc/src/pages/EnvVars.tsx packages/jacc/src/pages/EnvVars.test.tsx
git commit -m "feat(jacc): EnvVars 页接入目录化新增表单与槽位托管行"
```

---

### 任务 7：全量验证

- [ ] **步骤 1：运行全量验证**

在 `packages/jacc`：

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
cd src-tauri && cargo test -p jacc && cargo clippy -- -D warnings
```

预期：全绿。组件覆盖率 > 80%（`npx vitest run --coverage` 抽查新组件）。

- [ ] **步骤 2：端到端手测清单（视觉伴侣或实跑）**

- 项目 scope 下新增 `ANTHROPIC_API_KEY` → 落 `<proj>/.claude/settings.local.json` + `.gitignore` 含该行 + toast 提示。
- 项目 scope 下新增 `DISABLE_TELEMETRY=1`（boolean 开关）→ 落 `<proj>/.claude/settings.json`。
- combobox 搜 `AUTH_TOKEN` → `ANTHROPIC_AUTH_TOKEN` 置灰不可选。
- 全局 scope 下来源列隐藏；项目 scope 下显示 共享/本地 pill。

- [ ] **步骤 3：Commit（如有验证修复）**

```bash
git add -A && git commit -m "test(jacc): Plan B 全量验证与修复"
```

---

## 自检结论（Plan B）

**规格覆盖：** §5.5 env-catalog→T1；§3.3/§5.6 类型化值输入→T2、combobox→T3、槽位托管行→T6；§5.6 逐变量敏感分流→T4(后端)/T5(hook)；§4.4「Plan B 扩展后端按 env 子键分流」→T4；附录 A 数据→T1（含文档不一致点 CLAUDE_CODE_MAX_RETRIES 取 3）。

**关键修正（相对初稿）：** 逐变量分流不能靠前端拆 env + 通用 `write_config`（顶层 key 合并会丢数据），改为新增后端 env 子键命令（`read_env_layer`/`set_env_var`/`delete_env_var` + `write_env_kv`/`delete_env_kv`）——已在 T4 落实，授权来自 **Plan A 任务 15 的约束注释**（设计 §4.4 是「兼容性」小节，未列此后端命令，原计划「§4.4 授权」为误引，已订正）。

**已知取舍：** 自定义变量一律 `sensitive=false`（设计 §5.6），combobox useCustom 文案提示不拦截。

**类型一致性：** `EnvVarMeta`（type/sensitive/slotManaged/enumValues 约定贯穿 catalog/combobox/value-input/row）、`EnvEntry`/`EnvVarItem`（`origin: ConfigOrigin`）、`WriteConfigResult`（`wrote_local`）跨前后端一致。boolean 写盘 `'0'`/`'1'` 字符串贯穿 EnvValueInput ↔ set_env_var。

---

## 审查修复记录（执行前复审，2026-06-14）

执行前对照实际代码复审，订正如下：

- **T4（背景 + 自检结论）**：原"设计 §4.4 已授权 Plan B 扩展后端 env 子键命令"为**误引**——§4.4 是「兼容性」小节，未列此后端命令。订正为"授权来自 **Plan A 任务 15 的约束注释**"（该注释明文允许"扩展后端按 env 子键分流"）。不阻止实现，属事实对账订正。
- **T4 步骤 5**：补"config.rs 的 `#[cfg(test)] mod tests` 由 Plan A 任务 3/4 已新建，此处直接追加"说明。
- **T1 步骤 4**：补全提示追加 `ANTHROPIC_MODEL`（后端 `slot_env_key` fallback，设 `slotManaged: true`，与前端 `MODEL_ENV_KEYS` 对齐，避免 combobox 搜不到）。
- **T5 步骤 3**：加 `import type { ConfigOrigin } from '@/shared/hooks/useConfig'` 的**前置核对**（跨计划衔接：依赖 Plan A T9 已导出该类型，否则 tsc 报 no exported member；给出兜底方案）。
- **T6 步骤 3**：删 SourceBadge 三元冗余 `<SourceBadge scope={origin === 'models' ? 'models' : origin} />` → `<SourceBadge scope={origin} />`（scope 联合类型已含 `'models'`）。

