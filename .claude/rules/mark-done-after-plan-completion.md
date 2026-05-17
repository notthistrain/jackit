---
description: 使用 superpowers 完成计划后标记文档为已完成
globs:
  - docs/superpowers/**
---

# 完成计划后标记文档

当使用 superpowers 技能完成一个实现计划后，必须将对应的 design 和 plan 文档文件名加上 `done` 标识：

## 规则

将文件名中日期后面插入 `done`：

```
原始: 2026-05-16-jacc-claude-config-gui-design.md
完成: 2026-05-16-done-jacc-claude-config-gui-design.md

原始: 2026-05-16-jacc-plan1-scaffold.md
完成: 2026-05-16-done-jacc-plan1-scaffold.md
```

## 时机

在以下情况执行重命名：
- 使用 `subagent-driven-development` 或 `executing-plans` 完成所有任务后
- 使用 `finishing-a-development-branch` 收尾开发分支时

## 范围

- `docs/superpowers/specs/` 下的 design 文档
- `docs/superpowers/plans/` 下的 plan 文档
