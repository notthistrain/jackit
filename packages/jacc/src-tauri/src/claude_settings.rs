use std::path::{Path, PathBuf};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use std::time::{SystemTime, UNIX_EPOCH};

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

pub async fn read(path: &Path) -> AppResult<serde_json::Value> {
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    match serde_json::from_str::<serde_json::Value>(&content) {
        Ok(v) => Ok(v),
        Err(e) => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let backup = path.with_extension(format!("json.broken-{ts}"));
            if let Err(rename_err) = std::fs::rename(path, &backup) {
                tracing::error!(
                    path = %path.display(),
                    err = %rename_err,
                    "failed to backup corrupted settings.json"
                );
            } else {
                tracing::warn!(
                    path = %path.display(),
                    backup = %backup.display(),
                    reason = %e,
                    "settings.json corrupted, backed up"
                );
            }
            Err(AppError::SettingsCorrupted {
                path: path.to_string_lossy().to_string(),
                backup_path: backup.to_string_lossy().to_string(),
                reason: e.to_string(),
            })
        }
    }
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

    #[tokio::test]
    async fn read_returns_empty_object_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let v = read(&path).await.unwrap();
        assert!(v.as_object().unwrap().is_empty());
    }

    #[tokio::test]
    async fn read_corrupted_backs_up_and_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, b"{ not json").unwrap();

        let err = read(&path).await.unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("corrupted"), "got: {msg}");

        // 原文件应已被 rename 为 .broken-{ts}
        let entries: Vec<_> = std::fs::read_dir(dir.path()).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".broken-"))
            .collect();
        assert_eq!(entries.len(), 1);
    }
}
