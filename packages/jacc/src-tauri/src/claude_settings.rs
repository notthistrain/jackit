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

pub async fn update<F>(path: &Path, mutator: F) -> AppResult<()>
where
    F: FnOnce(&mut serde_json::Map<String, serde_json::Value>) -> AppResult<()>,
{
    let _guard = SETTINGS_LOCK.lock().await;

    let mut value = read(path).await?;
    if !value.is_object() {
        tracing::warn!(path = %path.display(), "settings.json top-level is not an object, resetting");
        value = serde_json::json!({});
    }
    let obj = value.as_object_mut().expect("guaranteed object above");
    mutator(obj)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    let content = serde_json::to_string_pretty(&value)?;
    use std::io::Write;
    tmp.write_all(content.as_bytes())?;
    tmp.flush()?;
    tmp.persist(path).map_err(|e| std::io::Error::other(e.to_string()))?;

    tracing::info!(path = %path.display(), "settings.json written");
    Ok(())
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

    #[tokio::test]
    async fn update_creates_file_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        update(&path, |obj| {
            obj.insert("model".into(), serde_json::json!("opus"));
            Ok(())
        }).await.unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(v["model"], "opus");
    }

    #[tokio::test]
    async fn update_preserves_other_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, r#"{"foo":"bar","model":"old"}"#).unwrap();

        update(&path, |obj| {
            obj.insert("model".into(), serde_json::json!("new"));
            Ok(())
        }).await.unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(v["foo"], "bar");
        assert_eq!(v["model"], "new");
    }

    #[tokio::test]
    async fn update_concurrent_writes_serialize() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        let p1 = path.clone();
        let p2 = path.clone();
        let h1 = tokio::spawn(async move {
            for i in 0..20 {
                update(&p1, move |obj| {
                    obj.insert(format!("a{i}"), serde_json::json!(i));
                    Ok(())
                }).await.unwrap();
            }
        });
        let h2 = tokio::spawn(async move {
            for i in 0..20 {
                update(&p2, move |obj| {
                    obj.insert(format!("b{i}"), serde_json::json!(i));
                    Ok(())
                }).await.unwrap();
            }
        });
        h1.await.unwrap();
        h2.await.unwrap();

        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        let obj = v.as_object().unwrap();
        // 40 个 key 都不应丢失
        assert_eq!(obj.len(), 40);
    }
}
