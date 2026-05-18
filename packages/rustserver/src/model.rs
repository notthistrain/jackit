use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Software {
    pub id: i64,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub ext: Option<String>,
    pub identifier: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SoftwareVersion {
    pub id: i64,
    pub software_id: i64,
    pub sequence: String,
    pub key: String,
    pub size: i64,
    pub force: bool,
    pub changelog: Option<String>,
    pub created_at: String,
}

/// publish/github 请求体（字段名与现有 Node.js server API 保持一致）
#[derive(Debug, Deserialize)]
pub struct GithubPublishInput {
    pub name: String,
    pub version: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    pub display: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub changelog: Option<String>,
    pub force: Option<bool>,
}

/// tools 列表响应中的软件条目（camelCase 输出与现有 API 兼容）
#[derive(Debug, Serialize)]
pub struct SoftwareListItem {
    pub id: i64,
    pub name: String,
    pub ext: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub versions: Vec<VersionItem>,
}

#[derive(Debug, Serialize)]
pub struct VersionItem {
    #[serde(rename = "versionId")]
    pub version_id: i64,
    pub sequence: String,
    pub size: i64,
    pub force: bool,
    pub changelog: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// 保存或更新软件版本（publish 核心逻辑）
pub async fn save_version(pool: &SqlitePool, input: &GithubPublishInput) -> AppResult<SoftwareVersion> {
    // 查找或创建 software
    let software = sqlx::query_as::<_, Software>(
        "SELECT * FROM software WHERE name = ?",
    )
    .bind(&input.name)
    .fetch_optional(pool)
    .await?;

    let software = if let Some(s) = software {
        // 更新可选字段
        if input.display.is_some() || input.identifier.is_some() || input.description.is_some() {
            sqlx::query(
                "UPDATE software SET updated_at = datetime('now'),
                 display_name = COALESCE(?, display_name),
                 identifier = COALESCE(?, identifier),
                 description = COALESCE(?, description)
                 WHERE id = ?",
            )
            .bind(&input.display)
            .bind(&input.identifier)
            .bind(&input.description)
            .bind(s.id)
            .execute(pool)
            .await?;
            sqlx::query_as::<_, Software>("SELECT * FROM software WHERE id = ?")
                .bind(s.id)
                .fetch_one(pool)
                .await?
        } else {
            s
        }
    } else {
        sqlx::query_as::<_, Software>(
            "INSERT INTO software (name, display_name, description, ext, identifier)
             VALUES (?, ?, ?, '', ?) RETURNING *",
        )
        .bind(&input.name)
        .bind(input.display.as_deref().unwrap_or(&input.name))
        .bind(&input.description)
        .bind(&input.identifier)
        .fetch_one(pool)
        .await?
    };

    // 查找或创建 version
    let existing = sqlx::query_as::<_, SoftwareVersion>(
        "SELECT * FROM software_version WHERE software_id = ? AND sequence = ?",
    )
    .bind(software.id)
    .bind(&input.version)
    .fetch_optional(pool)
    .await?;

    if let Some(v) = existing {
        // 更新已有版本时，如果 force 为 false，保留原有 size
        sqlx::query(
            "UPDATE software_version SET key = ?, size = ?, force = ?, changelog = ?
             WHERE id = ?",
        )
        .bind(&input.download_url)
        .bind(if input.force.unwrap_or(false) { 0 } else { v.size })
        .bind(input.force.unwrap_or(false))
        .bind(&input.changelog)
        .bind(v.id)
        .execute(pool)
        .await?;
        Ok(sqlx::query_as::<_, SoftwareVersion>("SELECT * FROM software_version WHERE id = ?")
            .bind(v.id)
            .fetch_one(pool)
            .await?)
    } else {
        sqlx::query_as::<_, SoftwareVersion>(
            "INSERT INTO software_version (software_id, sequence, key, size, force, changelog)
             VALUES (?, ?, ?, 0, ?, ?) RETURNING *",
        )
        .bind(software.id)
        .bind(&input.version)
        .bind(&input.download_url)
        .bind(input.force.unwrap_or(false))
        .bind(&input.changelog)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
    }
}

/// 获取所有软件及版本列表
pub async fn list_all_software(pool: &SqlitePool) -> AppResult<Vec<SoftwareListItem>> {
    let software_list = sqlx::query_as::<_, Software>(
        "SELECT * FROM software ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::new();
    for s in software_list {
        let versions = sqlx::query_as::<_, SoftwareVersion>(
            "SELECT * FROM software_version WHERE software_id = ? ORDER BY created_at DESC",
        )
        .bind(s.id)
        .fetch_all(pool)
        .await?;

        result.push(SoftwareListItem {
            id: s.id,
            name: s.name,
            ext: s.ext,
            display_name: s.display_name,
            identifier: s.identifier,
            description: s.description,
            versions: versions.into_iter().map(|v| VersionItem {
                version_id: v.id,
                sequence: v.sequence,
                size: v.size,
                force: v.force,
                changelog: v.changelog,
                created_at: v.created_at,
            }).collect(),
        });
    }
    Ok(result)
}

/// 按 ID 获取版本（用于 download/:id）
pub async fn get_version_by_id(pool: &SqlitePool, id: i64) -> AppResult<SoftwareVersion> {
    sqlx::query_as::<_, SoftwareVersion>("SELECT * FROM software_version WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Version '{}' not found", id)))
}

/// 按软件名获取最新版本（用于 download-latest/:name）
pub async fn get_latest_version(pool: &SqlitePool, name: &str) -> AppResult<(Software, SoftwareVersion)> {
    let software = sqlx::query_as::<_, Software>(
        "SELECT * FROM software WHERE name = ?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Software '{}' not found", name)))?;

    let version = sqlx::query_as::<_, SoftwareVersion>(
        "SELECT * FROM software_version WHERE software_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(software.id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("No versions for '{}'", name)))?;

    Ok((software, version))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::setup_test_db;

    #[tokio::test]
    async fn test_save_version_creates_software_and_version() {
        let pool = setup_test_db().await;
        let input = GithubPublishInput {
            name: "toolbox".to_string(),
            version: "0.1.0".to_string(),
            download_url: "https://github.com/test/toolbox-0.1.0.exe".to_string(),
            display: Some("工具箱".to_string()),
            identifier: Some("com.jackit.toolbox".to_string()),
            description: Some("测试描述".to_string()),
            changelog: Some("首个版本".to_string()),
            force: None,
        };
        let v = save_version(&pool, &input).await.unwrap();
        assert_eq!(v.sequence, "0.1.0");
        assert_eq!(v.key, "https://github.com/test/toolbox-0.1.0.exe");
    }

    #[tokio::test]
    async fn test_save_version_updates_existing() {
        let pool = setup_test_db().await;
        let input = GithubPublishInput {
            name: "toolbox".to_string(),
            version: "0.1.0".to_string(),
            download_url: "https://github.com/test/v1.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: Some("v1".to_string()), force: None,
        };
        save_version(&pool, &input).await.unwrap();

        let updated = GithubPublishInput {
            download_url: "https://github.com/test/v1-updated.exe".to_string(),
            changelog: Some("v1 updated".to_string()),
            ..input
        };
        let v = save_version(&pool, &updated).await.unwrap();
        assert_eq!(v.key, "https://github.com/test/v1-updated.exe");
    }

    #[tokio::test]
    async fn test_list_all_software() {
        let pool = setup_test_db().await;
        for name in &["toolbox", "jackcom"] {
            save_version(&pool, &GithubPublishInput {
                name: name.to_string(),
                version: "0.1.0".to_string(),
                download_url: format!("https://github.com/test/{}-0.1.0.exe", name),
                display: None, identifier: None, description: None,
                changelog: None, force: None,
            }).await.unwrap();
        }
        let list = list_all_software(&pool).await.unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|s| s.versions.len() == 1));
    }

    #[tokio::test]
    async fn test_get_latest_version() {
        let pool = setup_test_db().await;
        save_version(&pool, &GithubPublishInput {
            name: "toolbox".to_string(), version: "0.1.0".to_string(),
            download_url: "https://github.com/test/v1.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: None, force: None,
        }).await.unwrap();
        save_version(&pool, &GithubPublishInput {
            name: "toolbox".to_string(), version: "0.2.0".to_string(),
            download_url: "https://github.com/test/v2.exe".to_string(),
            display: None, identifier: None, description: None,
            changelog: None, force: None,
        }).await.unwrap();

        let (sw, v) = get_latest_version(&pool, "toolbox").await.unwrap();
        assert_eq!(sw.name, "toolbox");
        assert_eq!(v.sequence, "0.2.0");
    }

    #[tokio::test]
    async fn test_get_version_not_found() {
        let pool = setup_test_db().await;
        let result = get_version_by_id(&pool, 999).await;
        assert!(result.is_err());
    }
}
