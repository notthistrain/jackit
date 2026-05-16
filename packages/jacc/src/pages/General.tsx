import { useConfig } from '@/hooks/useConfig'
import { SourceBadge } from '@/components/SourceBadge'

export function General() {
  const { config, loading, writeConfig } = useConfig()

  if (loading || !config) {
    return <div className="p-6 text-xs text-muted">加载中...</div>
  }

  const getItem = (key: string) => config.items.find((i) => i.key === key)

  const model = getItem('model')
  const effortLevel = getItem('effortLevel')
  const skipDangerous = getItem('skipDangerousModePermissionPrompt')
  const enabledPlugins = getItem('enabledPlugins')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-medium text-foreground">通用设置</h2>
        <div className="flex gap-1.5 items-center text-[10px] text-muted">
          图例:
          <SourceBadge scope="project" />
          <SourceBadge scope="global" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* 模型 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">模型</div>
            <div className="text-[11px] text-muted">当前激活的模型配置</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground bg-sidebar px-2.5 py-1 rounded-[2px] border border-border">
              {(model?.value as string) || '未设置'}
            </span>
            {model && <SourceBadge scope={model.scope} />}
          </div>
        </div>

        {/* Effort Level */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">Effort Level</div>
            <div className="text-[11px] text-muted">推理努力程度</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={(effortLevel?.value as string) || 'high'}
              onChange={(e) =>
                writeConfig(effortLevel?.scope || 'global', 'effortLevel', e.target.value)
              }
              className="bg-sidebar border border-border text-foreground px-2.5 py-1 rounded-[2px] text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            {effortLevel && <SourceBadge scope={effortLevel.scope} />}
          </div>
        </div>

        {/* 跳过危险模式确认 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">跳过危险模式确认</div>
            <div className="text-[11px] text-muted">skipDangerousModePermissionPrompt</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                writeConfig(
                  skipDangerous?.scope || 'global',
                  'skipDangerousModePermissionPrompt',
                  !(skipDangerous?.value as boolean),
                )
              }
              className={`w-9 h-5 rounded-full relative transition-colors ${
                skipDangerous?.value ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                  skipDangerous?.value ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
            {skipDangerous && <SourceBadge scope={skipDangerous.scope} />}
          </div>
        </div>

        {/* 启用的插件 */}
        <div className="flex items-center justify-between p-3 bg-card border border-border-light rounded-[4px]">
          <div>
            <div className="text-[13px] font-medium text-foreground">启用的插件</div>
            <div className="text-[11px] text-muted">enabledPlugins</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {((enabledPlugins?.value as string[]) || []).map((p) => (
                <span key={p} className="text-[11px] px-2 py-0.5 bg-success-light text-success rounded-[2px]">
                  {p}
                </span>
              ))}
            </div>
            {enabledPlugins && <SourceBadge scope={enabledPlugins.scope} />}
          </div>
        </div>
      </div>
    </div>
  )
}
