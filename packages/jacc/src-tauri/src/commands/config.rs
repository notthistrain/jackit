use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    let global = read_settings_file(&get_global_settings_path());
    let project = if project_path.is_empty() {
        serde_json::json!({})
    } else {
        read_settings_file(&get_project_settings_path(&project_path))
    };

    let mut items: Vec<MergedConfigItem> = vec![];

    // 先加载全局配置
    if let Some(global_obj) = global.as_object() {
        for (key, value) in global_obj {
            items.push(MergedConfigItem {
                key: key.clone(),
                value: value.clone(),
                scope: ConfigScope::Global,
            });
        }
    }

    // 项目配置覆盖全局
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
}

#[tauri::command]
pub async fn write_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
    value: serde_json::Value,
) -> AppResult<()> {
    let path = match scope {
        ConfigScope::Global => get_global_settings_path(),
        ConfigScope::Project => {
            let pp = project_path.ok_or_else(|| {
                crate::error::AppError::Custom("项目路径不能为空".to_string())
            })?;
            get_project_settings_path(&pp)
        }
    };

    let mut settings = read_settings_file(&path);
    // 如果文件内容不是 JSON object，重新初始化为空 object
    if !settings.is_object() {
        settings = serde_json::json!({});
    }
    settings.as_object_mut().unwrap().insert(key, value);

    write_settings_file(&path, &settings)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_config(
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
) -> AppResult<()> {
    let path = match scope {
        ConfigScope::Global => get_global_settings_path(),
        ConfigScope::Project => {
            let pp = project_path.ok_or_else(|| {
                crate::error::AppError::Custom("项目路径不能为空".to_string())
            })?;
            get_project_settings_path(&pp)
        }
    };

    let mut settings = read_settings_file(&path);
    if let Some(obj) = settings.as_object_mut() {
        obj.remove(&key);
    }

    write_settings_file(&path, &settings)?;
    Ok(())
}

fn get_global_settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("settings.json")
}

fn get_project_settings_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".claude").join("settings.json")
}

fn read_settings_file(path: &PathBuf) -> serde_json::Value {
    if path.exists() {
        let content = std::fs::read_to_string(path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    }
}

fn write_settings_file(path: &PathBuf, value: &serde_json::Value) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(value).unwrap_or_default();
    std::fs::write(path, content)
}
