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

/// 项目本地 settings.local.json：<project>/.claude/settings.local.json
pub fn project_local_settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.local.json")
}

/// 确保 <project>/.gitignore 含 ".claude/settings.local.json" 行。
/// 已存在返回 false 不写；否则追加并原子写入，返回 true。
pub fn ensure_local_settings_gitignored(project: &Path) -> AppResult<bool> {
    const LINE: &str = ".claude/settings.local.json";
    let gitignore = project.join(".gitignore");
    let existing = if gitignore.exists() {
        std::fs::read_to_string(&gitignore)?
    } else {
        String::new()
    };
    if existing.lines().any(|l| l.trim() == LINE) {
        return Ok(false);
    }
    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(LINE);
    next.push('\n');
    let parent = gitignore.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent)?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    use std::io::Write;
    tmp.write_all(next.as_bytes())?;
    tmp.flush()?;
    tmp.persist(&gitignore).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(true)
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

fn slot_env_key(slot: &str) -> &'static str {
    match slot {
        "opus" => "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "sonnet" => "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "haiku" => "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        _ => "ANTHROPIC_MODEL",
    }
}

pub async fn write_slot_env(
    path: &Path,
    slot: &str,
    base_url: &str,
    api_key: &str,
    model_name: &str,
) -> AppResult<()> {
    let env_key = slot_env_key(slot);
    update(path, |obj| {
        let env = obj.entry("env").or_insert_with(|| serde_json::json!({}));
        let env_obj = env.as_object_mut().ok_or_else(|| {
            AppError::Custom("env is not an object".into())
        })?;
        env_obj.insert("ANTHROPIC_BASE_URL".into(), serde_json::json!(base_url));
        env_obj.insert("ANTHROPIC_AUTH_TOKEN".into(), serde_json::json!(api_key));
        env_obj.insert(env_key.into(), serde_json::json!(model_name));
        Ok(())
    }).await
}

pub async fn clear_slot_env(path: &Path, slot: &str) -> AppResult<()> {
    let env_key = slot_env_key(slot);
    update(path, |obj| {
        if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
            env.remove("ANTHROPIC_BASE_URL");
            env.remove("ANTHROPIC_AUTH_TOKEN");
            env.remove(env_key);
        }
        if obj.get("model").and_then(|v| v.as_str()) == Some(slot) {
            obj.remove("model");
        }
        Ok(())
    }).await
}

pub async fn write_kv(path: &Path, key: &str, value: serde_json::Value) -> AppResult<()> {
    update(path, |obj| {
        obj.insert(key.to_string(), value);
        Ok(())
    }).await
}

pub async fn delete_kv(path: &Path, key: &str) -> AppResult<()> {
    update(path, |obj| {
        obj.remove(key);
        Ok(())
    }).await
}

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

pub async fn purge_token(path: &Path, base_url: &str, api_key: &str) -> AppResult<()> {
    update(path, |obj| {
        let env_match = obj.get("env").and_then(|v| v.as_object()).map(|env| {
            env.get("ANTHROPIC_BASE_URL").and_then(|v| v.as_str()) == Some(base_url)
                && env.get("ANTHROPIC_AUTH_TOKEN").and_then(|v| v.as_str()) == Some(api_key)
        }).unwrap_or(false);

        if env_match {
            if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
                env.remove("ANTHROPIC_BASE_URL");
                env.remove("ANTHROPIC_AUTH_TOKEN");
                env.remove("ANTHROPIC_DEFAULT_OPUS_MODEL");
                env.remove("ANTHROPIC_DEFAULT_SONNET_MODEL");
                env.remove("ANTHROPIC_DEFAULT_HAIKU_MODEL");
            }
        }
        Ok(())
    }).await
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

    fn read_value(path: &Path) -> serde_json::Value {
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
    }

    #[tokio::test]
    async fn write_slot_env_writes_three_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        write_slot_env(&path, "opus", "https://api.anthropic.com", "sk-ant-aaa", "claude-opus-4-6")
            .await.unwrap();

        let v = read_value(&path);
        assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://api.anthropic.com");
        assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-ant-aaa");
        assert_eq!(v["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"], "claude-opus-4-6");
    }

    #[tokio::test]
    async fn clear_slot_env_removes_keys_and_top_model() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        write_slot_env(&path, "opus", "https://x.com", "sk-x", "m").await.unwrap();
        write_kv(&path, "model", serde_json::json!("opus")).await.unwrap();

        clear_slot_env(&path, "opus").await.unwrap();

        let v = read_value(&path);
        assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
        assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
        assert!(v["env"].get("ANTHROPIC_DEFAULT_OPUS_MODEL").is_none());
        assert!(v.get("model").is_none(), "top-level model should be cleared when matches slot");
    }

    #[tokio::test]
    async fn purge_token_clears_all_slots_with_matching_creds() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        write_slot_env(&path, "opus", "https://a.com", "sk-aaa", "m1").await.unwrap();

        purge_token(&path, "https://a.com", "sk-aaa").await.unwrap();

        let v = read_value(&path);
        assert!(v["env"].get("ANTHROPIC_BASE_URL").is_none());
        assert!(v["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
        assert!(v["env"].get("ANTHROPIC_DEFAULT_OPUS_MODEL").is_none());
    }

    #[tokio::test]
    async fn write_kv_and_delete_kv() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        write_kv(&path, "foo", serde_json::json!("bar")).await.unwrap();
        assert_eq!(read_value(&path)["foo"], "bar");
        delete_kv(&path, "foo").await.unwrap();
        assert!(read_value(&path).get("foo").is_none());
    }

    #[test]
    fn local_settings_path_appends_local_filename() {
        let p = project_local_settings_path(std::path::Path::new("/proj"));
        assert!(p.ends_with(".claude/settings.local.json"));
    }

    #[test]
    fn gitignore_creates_file_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let wrote = ensure_local_settings_gitignored(dir.path()).unwrap();
        assert!(wrote);
        let content = std::fs::read_to_string(dir.path().join(".gitignore")).unwrap();
        assert!(content.lines().any(|l| l.trim() == ".claude/settings.local.json"));
    }

    #[test]
    fn gitignore_idempotent_when_line_present() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".gitignore"), "node_modules\n.claude/settings.local.json\n").unwrap();
        let wrote = ensure_local_settings_gitignored(dir.path()).unwrap();
        assert!(!wrote);
    }

    #[test]
    fn gitignore_preserves_existing_and_appends() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".gitignore"), "dist\n").unwrap();
        ensure_local_settings_gitignored(dir.path()).unwrap();
        let content = std::fs::read_to_string(dir.path().join(".gitignore")).unwrap();
        assert!(content.contains("dist"));
        assert!(content.trim_end().ends_with(".claude/settings.local.json"));
    }

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
}
