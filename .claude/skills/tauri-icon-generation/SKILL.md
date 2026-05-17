---
name: tauri-icon-generation
description: Use when creating a new Tauri app in this monorepo or updating existing app icons — directly generates icons following the established design system without discussion.
---

# Tauri 图标生成

## 概述

为 jackit monorepo 中的 Tauri 应用生成图标。设计规范已确定，直接执行。

## 设计规范（已锁定）

**统一风格：** 极简线条，圆头端点，无填充背景

| 属性 | 值 |
|------|-----|
| 画布 | viewBox="0 0 256 256" |
| 线条色 | #4d7c0f（苔藓绿） |
| 线条粗细 | stroke-width="17" |
| 端点 | stroke-linecap="round" stroke-linejoin="round" |
| 特殊色 | #d4622a（Claude 橙，仅 Jacc 星爆） |
| 背景 | 透明（无背景色） |

**现有图标元素：**

| 应用 | 图标元素 |
|------|---------|
| Toolbox | 工具箱（箱体 + 提手 + 横条锁扣） |
| JackCom | 波形（上）+ DB9 串口 5 针（下） |
| Jacc | 三条滑块 + Claude Code 橙色星爆旋钮 |

**新应用图标设计原则：**
- 用一个能代表应用核心功能的简洁图形
- 只用线条，不用填充面
- 元素居中，留足边距（至少 16px）
- 复杂度与现有图标保持一致

## 生成流程

### 1. 编写 SVG

写入 `packages/<app>/src-tauri/icons/icon.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"
  stroke="#4d7c0f" stroke-linecap="round" stroke-linejoin="round" stroke-width="17">
  <!-- 图标内容 -->
</svg>
```

### 2. 生成所有尺寸

```bash
cd packages/<app>
npx sharp-cli -i src-tauri/icons/icon.svg -o src-tauri/icons/32x32.png resize 32 32
npx sharp-cli -i src-tauri/icons/icon.svg -o src-tauri/icons/128x128.png resize 128 128
npx sharp-cli -i src-tauri/icons/icon.svg -o src-tauri/icons/128x128@2x.png resize 256 256
npx png-to-ico src-tauri/icons/128x128@2x.png > src-tauri/icons/icon.ico
```

### 3. 最终文件清单

```
src-tauri/icons/
├── icon.svg          # 源文件
├── 32x32.png         # 任务栏
├── 128x128.png       # 应用列表
├── 128x128@2x.png    # 高 DPI
└── icon.ico          # Windows 可执行文件
```

## 注意事项

- stroke-width 17 在 256px 画布上视觉效果好，缩到 32px 仍清晰
- npx 首次运行会自动下载 sharp-cli 和 png-to-ico
- ICO 必须从 256px PNG 生成，不要用小尺寸
