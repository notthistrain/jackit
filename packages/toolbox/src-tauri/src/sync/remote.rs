use reqwest::blocking::Client;
use rusqlite::Connection;
use serde::Deserialize;

use crate::config::Config;
use crate::db::models;

#[derive(Debug, Deserialize)]
struct ApiRes<T> {
    success: bool,
    data: T,
    message: String,
}

#[derive(Debug, Deserialize)]
struct SoftwareVersionDTO {
    #[serde(rename = "versionId")]
    version_id: i64,
    sequence: String,
    size: i64,
    force: bool,
    changelog: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct SoftwareDTO {
    id: i64,
    name: String,
    identifier: String,
    #[serde(rename = "displayName")]
    display_name: String,
    description: String,
    ext: String,
    versions: Vec<SoftwareVersionDTO>,
}

pub struct SyncResult {
    pub success: bool,
    pub count: i32,
    pub message: String,
}

pub fn fetch_and_save(cfg: &Config, conn: &Connection) -> Result<SyncResult, String> {
    let url = format!("{}/api/tools/", cfg.server.address);
    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("API returned {}", resp.status()));
    }

    let body: ApiRes<Vec<SoftwareDTO>> = resp.json().map_err(|e| e.to_string())?;
    if !body.success {
        return Err(body.message);
    }

    let now = chrono_now();
    let mut count = 0;

    for sw in &body.data {
        if sw.versions.is_empty() {
            continue;
        }
        if sw.name == "toolbox" {
            continue;
        }
        count += 1;

        let tool = models::Tool {
            id: sw.id,
            name: sw.name.clone(),
            identifier: sw.identifier.clone(),
            display_name: sw.display_name.clone(),
            description: sw.description.clone(),
            ext: sw.ext.clone(),
            local_updated_at: now.clone(),
            ..Default::default()
        };
        // preserve install status from existing record
        let existing = models::query_tool_by_id(conn, sw.id).ok();
        let tool = if let Some(ex) = existing {
            models::Tool {
                version: ex.version,
                file_path: ex.file_path,
                installed_at: ex.installed_at,
                ..tool
            }
        } else {
            tool
        };
        models::upsert_tool(conn, &tool)?;

        for v in &sw.versions {
            let tv = models::ToolVersion {
                id: 0,
                tool_id: sw.id,
                version_id: v.version_id,
                sequence: v.sequence.clone(),
                size: v.size,
                force: v.force,
                changelog: v.changelog.clone(),
                downloaded: false,
                deleted: false,
                created_at: v.created_at.clone(),
            };
            models::upsert_version(conn, &tv)?;
        }
    }

    Ok(SyncResult {
        success: true,
        count,
        message: format!("成功同步 {} 个工具", count),
    })
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}
