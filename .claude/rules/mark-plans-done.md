# 标记已完成的计划文件

当使用 superpowers 技能（如 `executing-plans`、`subagent-driven-development`、`writing-plans` 等）完成一个批次的计划实施后，必须将对应的计划文件重命名，添加 `done-` 前缀以标记为已完成。

## 规则

1. 完成计划的所有步骤后，找到本次使用的 `plan.md` 和 `design.md` 文件
2. 将文件名开头加上 `done-` 前缀：
   - `plan.md` → `done-plan.md`
   - `design.md` → `done-design.md`
   - `xxx-plan.md` → `done-xxx-plan.md`
   - `xxx-design.md` → `done-xxx-design.md`
3. 使用 `git mv` 命令重命名（如果文件在 git 跟踪中），否则使用普通的 `mv`
4. 重命名后确认文件已正确标记

## 示例

```bash
# 计划完成前
ls .claude/plans/
# feature-x-plan.md  feature-x-design.md

# 计划完成后
git mv .claude/plans/feature-x-plan.md .claude/plans/done-feature-x-plan.md
git mv .claude/plans/feature-x-design.md .claude/plans/done-feature-x-design.md
```

## 注意事项

- 只在计划的所有步骤都已成功完成并验证后才执行重命名
- 如果计划只完成了部分，不要标记为 done
- 不要删除原文件内容，只是重命名
