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

#[tauri::command]
pub async fn read_merged_config(project_path: String) -> AppResult<MergedConfig> {
    log_command!("read_merged_config", {
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
) -> AppResult<()> {
    log_command!("write_config", {
        let path = match scope {
            ConfigScope::Global => crate::claude_settings::global_settings_path(),
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                crate::claude_settings::project_settings_path(Path::new(&pp))
            }
        };

        crate::claude_settings::write_kv(&path, &key, value).await?;
        tracing::info!(scope = ?scope, key = %key, path = %path.display(), "config written");
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
) -> AppResult<()> {
    log_command!("delete_config", {
        let path = match scope {
            ConfigScope::Global => crate::claude_settings::global_settings_path(),
            ConfigScope::Project => {
                let pp = project_path.ok_or_else(|| {
                    crate::error::AppError::Custom("项目路径不能为空".to_string())
                })?;
                crate::claude_settings::project_settings_path(Path::new(&pp))
            }
        };

        crate::claude_settings::delete_kv(&path, &key).await?;
        tracing::info!(scope = ?scope, key = %key, path = %path.display(), "config deleted");
        Ok(())
    })
}
