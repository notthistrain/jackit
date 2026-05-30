use std::path::{Path, PathBuf};
use tokio::sync::Mutex;

/// 全局互斥锁，串行化所有 settings.json 读改写。
/// 不变量：持锁期内绝不 spawn 任何会再次锁此 Mutex 的任务。
static SETTINGS_LOCK: Mutex<()> = Mutex::const_new(());

/// 全局 settings.json 路径：~/.claude/settings.json
pub fn global_settings_path() -> PathBuf {
    let home = dirs::home_dir().expect("HOME not found, jacc cannot start");
    home.join(".claude").join("settings.json")
}

/// 项目级 settings.json 路径：<project>/.claude/settings.json
pub fn project_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_path_ends_with_settings_json() {
        let p = global_settings_path();
        assert!(p.ends_with(".claude/settings.json") || p.ends_with(".claude\\settings.json"));
    }

    #[test]
    fn project_path_under_project_root() {
        let p = project_settings_path(Path::new("/tmp/proj"));
        assert!(p.to_string_lossy().contains(".claude"));
        assert!(p.ends_with("settings.json"));
    }
}
