# jacc 计划 7：数据目录迁移 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 jackcom 和 toolbox 的数据存储目录统一迁移到 `~/.jackit/` 规范

**架构：** 修改两个应用的 Rust 端路径逻辑，添加迁移代码将旧数据自动搬迁到新位置。同时更新项目文档。

**技术栈：** Rust, dirs crate

**前置依赖：** 无（可独立执行）

---

## 文件结构

| 文件 | 修改内容 |
|------|---------|
| `packages/jackcom/src-tauri/src/storage/mod.rs` | 修改 `get_db_path()` 到新路径 |
| `packages/toolbox/src-tauri/src/config/settings.rs` | 修改 `config_dir()` 和路径逻辑 |
| `CLAUDE.md` | 添加目录规范说明 |

---

### 任务 1：迁移 jackcom 数据路径

**文件：**
- 修改：`packages/jackcom/src-tauri/src/storage/mod.rs:43-49`

- [ ] **步骤 1：修改 get_db_path 函数**

将现有的：
```rust
fn get_db_path() -> PathBuf {
    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = app_data.join("jackcom");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jackcom.db")
}
```

改为：
```rust
fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = home.join(".jackit").join("toolbox").join("tools").join("jackcom").join("data");
    let new_path = new_dir.join("jackcom.db");

    // 迁移旧数据
    if !new_path.exists() {
        let old_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("jackcom");
        let old_path = old_dir.join("jackcom.db");
        if old_path.exists() {
            std::fs::create_dir_all(&new_dir).ok();
            std::fs::copy(&old_path, &new_path).ok();
            // 保留旧文件作为备份，不删除
        }
    }

    std::fs::create_dir_all(&new_dir).ok();
    new_path
}
```

- [ ] **步骤 2：验证编译**

运行：`cd D:/Project/jackit/packages/jackcom/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add packages/jackcom/src-tauri/src/storage/mod.rs
git commit -m "refactor(jackcom): 迁移数据目录到 ~/.jackit/ 规范"
```

---

### 任务 2：迁移 toolbox 数据路径

**文件：**
- 修改：`packages/toolbox/src-tauri/src/config/settings.rs:148-152, 189-191`

- [ ] **步骤 1：修改 config_dir 函数**

将现有的：
```rust
pub fn config_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".tbox")
}
```

改为：
```rust
pub fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = home.join(".jackit").join("toolbox");

    // 迁移旧数据
    let old_dir = home.join(".tbox");
    if old_dir.exists() && !new_dir.exists() {
        std::fs::create_dir_all(new_dir.parent().unwrap_or(&home)).ok();
        // 尝试移动整个目录
        if std::fs::rename(&old_dir, &new_dir).is_err() {
            // 如果跨盘符无法 rename，逐文件拷贝
            copy_dir_recursive(&old_dir, &new_dir).ok();
        }
    }

    std::fs::create_dir_all(&new_dir).ok();
    new_dir
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
```

- [ ] **步骤 2：修改 default_db_path 使用 data/ 子目录**

确保数据库路径为 `~/.jackit/toolbox/data/toolbox.db`：

```rust
pub fn default_db_path() -> String {
    "data/toolbox.db".to_string()
}
```

- [ ] **步骤 3：验证编译**

运行：`cd D:/Project/jackit/packages/toolbox/src-tauri && cargo check`
预期：编译通过

- [ ] **步骤 4：Commit**

```bash
git add packages/toolbox/src-tauri/src/config/settings.rs
git commit -m "refactor(toolbox): 迁移数据目录到 ~/.jackit/ 规范"
```

---

### 任务 3：更新项目文档

**文件：**
- 修改：`CLAUDE.md`

- [ ] **步骤 1：在 CLAUDE.md 中添加目录规范**

在文件末尾添加：

```markdown
## 数据目录规范

所有 jackit 应用的数据统一存储在 `~/.jackit/` 下：

```
~/.jackit/
├── toolbox/
│   ├── data/
│   │   └── toolbox.db
│   ├── config/
│   │   └── toolbox.yaml
│   ├── log/
│   └── tools/
│       ├── jackcom/
│       │   ├── jackcom.exe
│       │   ├── data/
│       │   │   └── jackcom.db
│       │   ├── config/
│       │   └── log/
│       └── jacc/
│           ├── jacc.exe
│           ├── data/
│           │   └── jacc.db
│           ├── config/
│           └── log/
```

每个 app 统一子目录规范：
- `data/` — 数据库文件
- `config/` — 配置文件
- `log/` — 日志文件
- 可执行文件在 app 根目录

Toolbox 是顶层管理者，被管理的 app 安装在 `tools/<appname>/` 下。
```

- [ ] **步骤 2：Commit**

```bash
git add CLAUDE.md
git commit -m "docs: 添加数据目录规范到 CLAUDE.md"
```
