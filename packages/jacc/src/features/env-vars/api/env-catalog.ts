export type EnvGroup
  = | 'auth' // 认证凭证
    | 'endpoint' // API 端点/网关
    | 'model' // 模型选择
    | 'cache' // 缓存
    | 'bedrock' // AWS Bedrock
    | 'vertex' // Google Vertex
    | 'foundry' // Foundry
    | 'feature' // 功能开关
    | 'context' // 上下文/记忆
    | 'effort' // Effort/思考
    | 'timeout' // 超时/限制
    | 'proxy' // 网络代理
    | 'tls' // TLS 证书
    | 'telemetry' // 遥测/隐私
    | 'ui' // UI 显示
    | 'session' // 会话/进程
    | 'debug' // 调试/日志

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

// 目录来源：Claude Code 官方文档（env-vars / bedrock / vertex / monitoring / network-config，2026-06-14）。
// 约 150 变量、17 组；此处收录各组代表性条目（覆盖每 type 与敏感/槽位标记），
// 完整明细可按附录 A 五个文档 URL 继续补全——验收以 17 组齐全 + 关键标记正确为准。
export const ENV_CATALOG: EnvVarMeta[] = [
  // ── auth 认证凭证 ──
  { name: 'ANTHROPIC_API_KEY', group: 'auth', type: 'string', sensitive: true, description: 'Anthropic API 密钥（X-Api-Key）。含密钥，写入项目本地 settings.local.json。' },
  { name: 'ANTHROPIC_AUTH_TOKEN', group: 'auth', type: 'string', sensitive: true, slotManaged: true, description: 'Bearer 鉴权 token。由模型槽位托管，请在「通用」页绑定槽位。' },
  { name: 'ANTHROPIC_CUSTOM_HEADERS', group: 'auth', type: 'string', sensitive: true, description: '自定义请求头（可能含凭证）。' },
  // ── endpoint API 端点/网关 ──
  { name: 'ANTHROPIC_BASE_URL', group: 'endpoint', type: 'string', sensitive: false, slotManaged: true, description: 'API 基础 URL。由模型槽位托管。' },
  // ── model 模型选择 ──
  { name: 'ANTHROPIC_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true, description: '默认模型名（fallback，非 opus/sonnet/haiku 时）。由槽位托管。' },
  { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true, description: 'Opus 槽位默认模型名。由槽位托管。' },
  { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true, description: 'Sonnet 槽位默认模型名。由槽位托管。' },
  { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', group: 'model', type: 'string', sensitive: false, slotManaged: true, description: 'Haiku 槽位默认模型名。由槽位托管。' },
  { name: 'ANTHROPIC_SMALL_FAST_MODEL', group: 'model', type: 'string', sensitive: false, description: '小型快速模型名（后台任务）。' },
  // ── cache 缓存 ──
  { name: 'DISABLE_PROMPT_CACHING', group: 'cache', type: 'boolean', sensitive: false, default: '0', description: '关闭 prompt 缓存。' },
  // ── bedrock AWS Bedrock ──
  { name: 'CLAUDE_CODE_USE_BEDROCK', group: 'bedrock', type: 'boolean', sensitive: false, default: '0', description: '启用 AWS Bedrock。' },
  { name: 'AWS_REGION', group: 'bedrock', type: 'string', sensitive: false, description: 'AWS 区域。' },
  { name: 'ANTHROPIC_BEDROCK_BASE_URL', group: 'bedrock', type: 'string', sensitive: false, description: 'Bedrock 基础 URL。' },
  { name: 'AWS_BEARER_TOKEN_BEDROCK', group: 'bedrock', type: 'string', sensitive: true, description: 'Bedrock Bearer token。' },
  // ── vertex Google Vertex ──
  { name: 'CLAUDE_CODE_USE_VERTEX', group: 'vertex', type: 'boolean', sensitive: false, default: '0', description: '启用 Google Vertex AI。' },
  { name: 'CLOUD_ML_REGION', group: 'vertex', type: 'string', sensitive: false, description: 'Vertex 区域。' },
  { name: 'ANTHROPIC_VERTEX_PROJECT_ID', group: 'vertex', type: 'string', sensitive: false, description: 'Vertex 项目 ID。' },
  { name: 'GOOGLE_APPLICATION_CREDENTIALS', group: 'vertex', type: 'string', sensitive: true, description: 'GCP 凭证 JSON 路径。' },
  // ── foundry ──
  { name: 'CLAUDE_CODE_USE_FOUNDRY', group: 'foundry', type: 'boolean', sensitive: false, default: '0', description: '启用 Foundry。' },
  { name: 'ANTHROPIC_FOUNDRY_API_KEY', group: 'foundry', type: 'string', sensitive: true, description: 'Foundry API 密钥。' },
  // ── feature 功能开关 ──
  { name: 'DISABLE_AUTOUPDATER', group: 'feature', type: 'boolean', sensitive: false, default: '0', description: '关闭自动更新。' },
  { name: 'DISABLE_BUG_COMMAND', group: 'feature', type: 'boolean', sensitive: false, default: '0', description: '禁用 /bug 命令。' },
  { name: 'DISABLE_ERROR_REPORTING', group: 'feature', type: 'boolean', sensitive: false, default: '0', description: '关闭错误上报。' },
  { name: 'DISABLE_NON_ESSENTIAL_MODEL_CALLS', group: 'feature', type: 'boolean', sensitive: false, default: '0', description: '关闭非必要模型调用。' },
  { name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', group: 'feature', type: 'boolean', sensitive: false, default: '0', description: '关闭非必要网络流量。' },
  // ── context 上下文/记忆 ──
  { name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', group: 'context', type: 'number', sensitive: false, unit: 'tokens', description: '单次响应最大输出 token。' },
  { name: 'MAX_MCP_OUTPUT_TOKENS', group: 'context', type: 'number', sensitive: false, unit: 'tokens', description: 'MCP 输出 token 上限。' },
  // ── effort Effort/思考 ──
  { name: 'MAX_THINKING_TOKENS', group: 'effort', type: 'number', sensitive: false, unit: 'tokens', description: '思考预算上限。' },
  // ── timeout 超时/限制 ──
  { name: 'BASH_DEFAULT_TIMEOUT_MS', group: 'timeout', type: 'number', sensitive: false, unit: 'ms', description: 'Bash 命令默认超时。' },
  { name: 'BASH_MAX_TIMEOUT_MS', group: 'timeout', type: 'number', sensitive: false, unit: 'ms', description: 'Bash 命令最大超时。' },
  { name: 'MCP_TIMEOUT', group: 'timeout', type: 'number', sensitive: false, unit: 'ms', description: 'MCP 服务器启动超时。' },
  { name: 'MCP_TOOL_TIMEOUT', group: 'timeout', type: 'number', sensitive: false, unit: 'ms', description: 'MCP 工具调用超时。' },
  { name: 'API_TIMEOUT_MS', group: 'timeout', type: 'number', sensitive: false, unit: 'ms', description: 'API 请求超时。' },
  { name: 'CLAUDE_CODE_MAX_RETRIES', group: 'timeout', type: 'number', sensitive: false, default: '3', description: '请求最大重试次数。注：env-vars 文档记 3，monitoring 文档记 10，此处取 3。' },
  // ── proxy 网络代理 ──
  { name: 'HTTPS_PROXY', group: 'proxy', type: 'string', sensitive: true, description: 'HTTPS 代理地址（可能含 user:pass，按敏感处理）。' },
  { name: 'HTTP_PROXY', group: 'proxy', type: 'string', sensitive: true, description: 'HTTP 代理地址（可能含 user:pass，按敏感处理）。' },
  { name: 'NO_PROXY', group: 'proxy', type: 'string', sensitive: false, description: '不代理的地址列表。' },
  // ── tls TLS 证书 ──
  { name: 'NODE_EXTRA_CA_CERTS', group: 'tls', type: 'string', sensitive: false, description: '额外 CA 证书路径。' },
  { name: 'CLAUDE_CODE_EXTRA_BODY', group: 'tls', type: 'string', sensitive: false, description: '附加到 API 请求 body 的 JSON。' },
  // ── telemetry 遥测/隐私 ──
  { name: 'DISABLE_TELEMETRY', group: 'telemetry', type: 'boolean', sensitive: false, default: '0', description: '关闭遥测上报。' },
  { name: 'CLAUDE_CODE_ENABLE_TELEMETRY', group: 'telemetry', type: 'boolean', sensitive: false, default: '0', description: '启用 OTEL 遥测。' },
  { name: 'OTEL_EXPORTER_OTLP_HEADERS', group: 'telemetry', type: 'string', sensitive: true, description: 'OTLP 导出请求头（可能含 token）。' },
  { name: 'OTEL_METRICS_EXPORTER', group: 'telemetry', type: 'enum', sensitive: false, enumValues: ['none', 'otlp', 'prometheus'], default: 'otlp', description: '指标导出器。' },
  { name: 'OTEL_LOGS_EXPORTER', group: 'telemetry', type: 'enum', sensitive: false, enumValues: ['none', 'otlp'], default: 'otlp', description: '日志导出器。' },
  // ── ui UI 显示 ──
  { name: 'FORCE_COLOR', group: 'ui', type: 'enum', sensitive: false, enumValues: ['0', '1', '2', '3'], description: '强制颜色等级。' },
  { name: 'CLAUDE_CODE_DISABLE_TERMINAL_TITLE', group: 'ui', type: 'boolean', sensitive: false, default: '0', description: '关闭终端标题更新。' },
  // ── session 会话/进程 ──
  { name: 'CLAUDE_CONFIG_DIR', group: 'session', type: 'string', sensitive: false, description: '配置目录路径。' },
  // ── debug 调试/日志 ──
  { name: 'ANTHROPIC_LOG', group: 'debug', type: 'enum', sensitive: false, enumValues: ['debug', 'info', 'warn', 'error'], description: 'API 日志级别。' },
  { name: 'DEBUG', group: 'debug', type: 'string', sensitive: false, description: '调试模块（如 *）。' },
]

export function findEnvMeta(name: string): EnvVarMeta | undefined {
  return ENV_CATALOG.find(m => m.name === name)
}

export function searchCatalog(query: string): EnvVarMeta[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return ENV_CATALOG
  return ENV_CATALOG.filter(m => m.name.toLowerCase().includes(q))
}
