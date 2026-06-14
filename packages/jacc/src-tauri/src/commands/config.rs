use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConfigScope {
    Global,
    Project,
}

#[derive(Debug, Serialize)]
pub struct MergedConfigItem {
    pub key: String,
    pub value: serde_json::Value,
    pub scope: ConfigScope,
}

#[derive(Debug, Serialize)]
pub struct MergedConfig {
    pub items: Vec<MergedConfigItem>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConfigOrigin {
    Global,
    Shared,
    Local,
}

#[derive(Debug, Serialize)]
pub struct LayerConfigItem {
    pub key: String,
    pub value: serde_json::Value,
    pub origin: ConfigOrigin,
}

#[derive(Debug, Serialize)]
pub struct LayerConfig {
    pub items: Vec<LayerConfigItem>,
}

/// 读 shared(+可选 local) 并按 origin 标记；local 同名覆盖 shared。
/// local 为 None（全局 scope）时全部标 Shared，调用方负责改写为 Global。
async fn read_layer_at(shared: &Path, local: Option<&Path>) -> AppResult<LayerConfig> {
    let shared_val = crate::claude_settings::read(shared).await?;
    let mut items: Vec<LayerConfigItem> = Vec::new();
    if let Some(obj) = shared_val.as_object() {
        for (k, v) in obj {
            items.push(LayerConfigItem {
                key: k.clone(),
                value: v.clone(),
                origin: ConfigOrigin::Shared,
            });
        }
    }
    if let Some(local_path) = local {
        let local_val = crate::claude_settings::read(local_path).await?;
        if let Some(obj) = local_val.as_object() {
            for (k, v) in obj {
                if let Some(slot) = items.iter_mut().find(|i| &i.key == k) {
                    slot.value = v.clone();
                    slot.origin = ConfigOrigin::Local;
                } else {
                    items.push(LayerConfigItem {
                        key: k.clone(),
                        value: v.clone(),
                        origin: ConfigOrigin::Local,
                    });
                }
            }
        }
    }
    Ok(LayerConfig { items })
}

#[derive(Debug, Serialize)]
pub struct WriteConfigResult {
    pub wrote_local: bool,
    pub gitignore_updated: bool,
}

/// 项目 scope 下按 sensitive 分流写入。
async fn write_kv_routed(
    project: &Path,
    key: &str,
    value: serde_json::Value,
    sensitive: bool,
) -> AppResult<WriteConfigResult> {
    if sensitive {
        let local = crate::claude_settings::project_local_settings_path(project);
        crate::claude_settings::write_kv(&local, key, value).await?;
        let gitignore_updated = crate::claude_settings::ensure_local_settings_gitignored(project)?;
        Ok(WriteConfigResult { wrote_local: true, gitignore_updated })
    } else {
        let shared = crate::claude_settings::project_settings_path(project);
        crate::claude_settings::write_kv(&shared, key, value).await?;
        Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
    }
}

/// 项目 scope 下按 origin 删对应文件。
async fn delete_kv_routed(project: &Path, key: &str, origin: ConfigOrigin) -> AppResult<()> {
    let path = match origin {
        ConfigOrigin::Local => crate::claude_settings::project_local_settings_path(project),
        // Shared 与 Global（项目场景不应出现 Global）都删 shared 文件
        _ => crate::claude_settings::project_settings_path(project),
    };
    crate::claude_settings::delete_kv(&path, key).await
}

#[tauri::command]
pub async fn read_config_layer(
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<LayerConfig> {
    log_read_command!("read_config_layer", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                let mut layer = read_layer_at(&path, None).await?;
                for it in layer.items.iter_mut() {
                    it.origin = ConfigOrigin::Global;
                }
                Ok(layer)
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                let shared = crate::claude_settings::project_settings_path(&validated);
                let local = crate::claude_settings::project_local_settings_path(&validated);
                read_layer_at(&shared, Some(local.as_path())).await
            }
        }
    })
}

#[tauri::command]
pub async fn read_merged_config(project_path: String) -> AppResult<MergedConfig> {
    log_read_command!("read_merged_config", {
        let global_path = crate::claude_settings::global_settings_path();
        let project_path_buf = if project_path.is_empty() {
            None
        } else {
            Some(crate::claude_settings::project_settings_path(Path::new(
                &project_path,
            )))
        };

        let global = crate::claude_settings::read(&global_path).await?;
        let project = match project_path_buf.as_deref() {
            Some(p) => crate::claude_settings::read(p).await?,
            None => serde_json::json!({}),
        };

        let mut items: Vec<MergedConfigItem> = vec![];

        if let Some(global_obj) = global.as_object() {
            for (key, value) in global_obj {
                items.push(MergedConfigItem {
                    key: key.clone(),
                    value: value.clone(),
                    scope: ConfigScope::Global,
                });
            }
        }

        if let Some(project_obj) = project.as_object() {
            for (key, value) in project_obj {
                if let Some(existing) = items.iter_mut().find(|i| i.key == *key) {
                    existing.value = value.clone();
                    existing.scope = ConfigScope::Project;
                } else {
                    items.push(MergedConfigItem {
                        key: key.clone(),
                        value: value.clone(),
                        scope: ConfigScope::Project,
                    });
                }
            }
        }

        Ok(MergedConfig { items })
    })
}

#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
    sensitive: bool,
) -> AppResult<WriteConfigResult> {
    log_command!("write_config", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                crate::claude_settings::write_kv(&path, &key, value).await?;
                Ok(WriteConfigResult { wrote_local: false, gitignore_updated: false })
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                write_kv_routed(&validated, &key, value, sensitive).await
            }
        }
    })
}

#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    origin: ConfigOrigin,
) -> AppResult<()> {
    log_command!("delete_config", {
        match scope {
            ConfigScope::Global => {
                let path = crate::claude_settings::global_settings_path();
                crate::claude_settings::delete_kv(&path, &key).await
            }
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                let validated = crate::path_guard::validate_project_path(&pp)?;
                delete_kv_routed(&validated, &key, origin).await
            }
        }
    })
}

#[tauri::command]
pub async fn reset_corrupted_settings(
    scope: ConfigScope,
    project_path: Option<String>,
) -> AppResult<()> {
    use std::io::Write;
    let path = match scope {
        ConfigScope::Global => crate::claude_settings::global_settings_path(),
        ConfigScope::Project => {
            let pp = project_path.ok_or_else(|| {
                crate::error::AppError::Custom("项目路径不能为空".into())
            })?;
            crate::claude_settings::project_settings_path(Path::new(&pp))
        }
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    tmp.write_all(b"{}\n")?;
    tmp.flush()?;
    tmp.persist(&path).map_err(|e| std::io::Error::other(e.to_string()))?;
    tracing::warn!(path = %path.display(), "settings.json reset to empty object by user");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn layer_global_reads_only_global_origin() {
        let dir = tempfile::tempdir().unwrap();
        let shared = dir.path().join("settings.json");
        std::fs::write(&shared, r#"{"a":1,"b":2}"#).unwrap();
        let local = dir.path().join("settings.local.json");
        // local 不存在时 helper 全部标 Shared（Global origin 由 read_config_layer command 层改写）
        let items = read_layer_at(&shared, Some(local.as_path())).await.unwrap().items;
        assert!(items.iter().all(|i| matches!(i.origin, ConfigOrigin::Shared)));
        assert_eq!(items.len(), 2);
    }

    #[tokio::test]
    async fn layer_local_overrides_shared_and_marks_origin() {
        let dir = tempfile::tempdir().unwrap();
        let shared = dir.path().join("settings.json");
        std::fs::write(&shared, r#"{"a":1,"b":2}"#).unwrap();
        let local = dir.path().join("settings.local.json");
        std::fs::write(&local, r#"{"b":99,"c":3}"#).unwrap();
        let items = read_layer_at(&shared, Some(local.as_path())).await.unwrap().items;
        let get = |k: &str| items.iter().find(|i| i.key == k).unwrap();
        assert_eq!(get("a").value, serde_json::json!(1));
        assert!(matches!(get("a").origin, ConfigOrigin::Shared));
        assert_eq!(get("b").value, serde_json::json!(99));
        assert!(matches!(get("b").origin, ConfigOrigin::Local));
        assert!(matches!(get("c").origin, ConfigOrigin::Local));
    }

    #[tokio::test]
    async fn write_project_sensitive_goes_to_local_and_gitignores() {
        let dir = tempfile::tempdir().unwrap();
        let proj = dir.path();
        std::fs::create_dir_all(proj.join(".claude")).unwrap();
        let res = write_kv_routed(proj, "ANTHROPIC_AUTH_TOKEN", serde_json::json!("sk-x"), true)
            .await
            .unwrap();
        assert!(res.wrote_local);
        assert!(res.gitignore_updated);
        let local = std::fs::read_to_string(proj.join(".claude/settings.local.json")).unwrap();
        assert!(local.contains("sk-x"));
        assert!(!proj.join(".claude/settings.json").exists());
        let gi = std::fs::read_to_string(proj.join(".gitignore")).unwrap();
        assert!(gi.contains(".claude/settings.local.json"));
    }

    #[tokio::test]
    async fn write_project_nonsensitive_goes_to_shared() {
        let dir = tempfile::tempdir().unwrap();
        let proj = dir.path();
        std::fs::create_dir_all(proj.join(".claude")).unwrap();
        let res = write_kv_routed(proj, "effortLevel", serde_json::json!("high"), false)
            .await
            .unwrap();
        assert!(!res.wrote_local);
        let shared = std::fs::read_to_string(proj.join(".claude/settings.json")).unwrap();
        assert!(shared.contains("high"));
        assert!(!proj.join(".claude/settings.local.json").exists());
    }

    #[tokio::test]
    async fn delete_local_origin_removes_from_local_file() {
        let dir = tempfile::tempdir().unwrap();
        let proj = dir.path();
        std::fs::create_dir_all(proj.join(".claude")).unwrap();
        std::fs::write(proj.join(".claude/settings.local.json"), r#"{"ANTHROPIC_AUTH_TOKEN":"sk-x"}"#).unwrap();
        delete_kv_routed(proj, "ANTHROPIC_AUTH_TOKEN", ConfigOrigin::Local).await.unwrap();
        let local = std::fs::read_to_string(proj.join(".claude/settings.local.json")).unwrap();
        assert!(!local.contains("sk-x"));
    }
}
