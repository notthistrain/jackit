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
pub async fn save_version(
    pool: &SqlitePool,
    input: &GithubPublishInput,
) -> AppResult<SoftwareVersion> {
    // 查找或创建 software
    let software = sqlx::query_as::<_, Software>("SELECT * FROM software WHERE name = ?")
        .bind(&input.name)
        .fetch_optional(pool)
        .await?;

    let software = if let Some(s) = software {
        tracing::debug!(id = s.id, name = %s.name, "software found, updating");
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
        tracing::info!(name = %input.name, "creating new software");
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
        tracing::info!(
            software = %input.name,
            version = %input.version,
            version_id = v.id,
            "updating existing version"
        );
        // 更新已有版本时，如果 force 为 false，保留原有 size
        sqlx::query(
            "UPDATE software_version SET key = ?, size = ?, force = ?, changelog = ?
             WHERE id = ?",
        )
        .bind(&input.download_url)
        .bind(if input.force.unwrap_or(false) {
            0
        } else {
            v.size
        })
        .bind(input.force.unwrap_or(false))
        .bind(&input.changelog)
        .bind(v.id)
        .execute(pool)
        .await?;
        Ok(
            sqlx::query_as::<_, SoftwareVersion>("SELECT * FROM software_version WHERE id = ?")
                .bind(v.id)
                .fetch_one(pool)
                .await?,
        )
    } else {
        tracing::info!(
            software = %input.name,
            version = %input.version,
            "creating new version"
        );
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
    let software_list =
        sqlx::query_as::<_, Software>("SELECT * FROM software ORDER BY created_at DESC")
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
            versions: versions
                .into_iter()
                .map(|v| VersionItem {
                    version_id: v.id,
                    sequence: v.sequence,
                    size: v.size,
                    force: v.force,
                    changelog: v.changelog,
                    created_at: v.created_at,
                })
                .collect(),
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
pub async fn get_latest_version(
    pool: &SqlitePool,
    name: &str,
) -> AppResult<(Software, SoftwareVersion)> {
    let software = sqlx::query_as::<_, Software>("SELECT * FROM software WHERE name = ?")
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

// ===== 访问量统计（page_view）=====

/// 一条原始访问记录（对应 page_view 表一行）
#[derive(Debug, sqlx::FromRow)]
pub struct PageView {
    pub id: i64,
    pub site: String,
    pub path: String,
    pub visitor_hash: String,
    pub ip: Option<String>,
    pub ua: Option<String>,
    pub referer: Option<String>,
    pub device: Option<String>,
    pub created_at: String,
}

/// 打点上报请求体
///
/// `ts` 为秒级 unix 时间戳，仅用于签名防重放校验；
/// 入库时间一律以服务端 `datetime('now')` 为准，避免客户端时钟造假。
#[derive(Debug, Clone, Deserialize)]
pub struct TrackInput {
    pub site: String,
    pub path: String,
    pub referer: Option<String>,
    pub ts: i64,
    pub sig: String,
}

/// 中间件校验通过后注入到请求 extensions 的数据，供 track handler 使用。
#[derive(Debug, Clone)]
pub struct TrackedData {
    pub input: TrackInput,
    pub ip: Option<String>,
    pub ua: Option<String>,
}

/// 时间序列聚合点（按天/小时分桶）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OverviewPoint {
    pub bucket: String,
    pub pv: i64,
    pub uv: i64,
}

/// 维度计数（按 path / referer / device 分组的 Top-N）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DimensionCount {
    pub key: Option<String>,
    pub count: i64,
}

/// 写入一条访问记录。`created_at` 由 DB 默认值填充（服务端 UTC）。
#[allow(clippy::too_many_arguments)] // 7 个字段即 page_view 的列，语义直观
pub async fn insert_page_view(
    pool: &SqlitePool,
    site: &str,
    path: &str,
    visitor_hash: &str,
    ip: Option<&str>,
    ua: Option<&str>,
    referer: Option<&str>,
    device: Option<&str>,
) -> AppResult<i64> {
    let result = sqlx::query(
        "INSERT INTO page_view (site, path, visitor_hash, ip, ua, referer, device)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(site)
    .bind(path)
    .bind(visitor_hash)
    .bind(ip)
    .bind(ua)
    .bind(referer)
    .bind(device)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

/// 按时间粒度聚合 PV / UV。
/// `granularity` 取值 "day" | "hour"，其它值按 day 处理。
/// `from` / `to` 为 UTC 时间字符串（如 "2026-07-01" 或 "2026-07-01 00:00:00"），
/// 通过字符串比较过滤 created_at。
pub async fn query_overview(
    pool: &SqlitePool,
    site: &str,
    from: &str,
    to: &str,
    granularity: &str,
) -> AppResult<Vec<OverviewPoint>> {
    let fmt = match granularity {
        "hour" => "%Y-%m-%dT%H:00:00",
        _ => "%Y-%m-%d",
    };
    let sql = format!(
        "SELECT strftime('{fmt}', created_at) AS bucket,
                COUNT(*)              AS pv,
                COUNT(DISTINCT visitor_hash) AS uv
         FROM page_view
         WHERE site = ? AND created_at >= ? AND created_at < ?
         GROUP BY bucket
         ORDER BY bucket ASC"
    );
    let rows = sqlx::query_as::<_, OverviewPoint>(&sql)
        .bind(site)
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

/// 按页面路径 Top-N。
pub async fn query_top_paths(
    pool: &SqlitePool,
    site: &str,
    from: &str,
    to: &str,
    limit: i64,
) -> AppResult<Vec<DimensionCount>> {
    sqlx::query_as::<_, DimensionCount>(
        "SELECT path AS key, COUNT(*) AS count
         FROM page_view
         WHERE site = ? AND created_at >= ? AND created_at < ?
         GROUP BY path
         ORDER BY count DESC, path ASC
         LIMIT ?",
    )
    .bind(site)
    .bind(from)
    .bind(to)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// 按 referer 或 device 维度 Top-N（`field` 仅接受 "referer" | "device"）。
pub async fn query_top_sources(
    pool: &SqlitePool,
    site: &str,
    from: &str,
    to: &str,
    field: &str,
    limit: i64,
) -> AppResult<Vec<DimensionCount>> {
    // 白名单限定列名，杜绝 SQL 注入
    let column = match field {
        "device" => "device",
        _ => "referer",
    };
    let sql = format!(
        "SELECT {column} AS key, COUNT(*) AS count
         FROM page_view
         WHERE site = ? AND created_at >= ? AND created_at < ?
           AND {column} IS NOT NULL AND {column} <> ''
         GROUP BY {column}
         ORDER BY count DESC
         LIMIT ?"
    );
    sqlx::query_as::<_, DimensionCount>(&sql)
        .bind(site)
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

// ===== 用户留言（message）=====

/// 留言提交请求体
///
/// `ts` 为秒级 unix 时间戳，仅用于签名防重放校验；
/// `path` 可选，用于标记留言所在页面。
/// 签名拼接规则与 track 一致：`{site}|{path_or_empty}|{ts}`。
#[derive(Debug, Clone, Deserialize)]
pub struct MessageInput {
    pub site: String,
    pub path: Option<String>,
    pub nickname: String,
    pub content: String,
    pub ts: i64,
    pub sig: String,
}

/// 中间件校验通过后注入到请求 extensions 的数据，供 submit handler 使用。
#[derive(Debug, Clone)]
pub struct MessageData {
    pub input: MessageInput,
    pub ip: Option<String>,
    pub ua: Option<String>,
}

/// 留言列表查询参数
#[derive(Debug, Deserialize)]
pub struct MessageListQuery {
    pub site: String,
    /// 0=待处理（默认）、1=已消费、all=全部
    pub consumed: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
}

/// 留言列表项（对外输出，省略 ip/ua/visitor_hash 等审计字段）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MessageListItem {
    pub id: i64,
    pub site: String,
    pub path: Option<String>,
    pub nickname: String,
    pub content: String,
    pub consumed: bool,
    pub created_at: String,
}

/// 留言列表分页响应
#[derive(Debug, Serialize)]
pub struct MessageListPage {
    pub items: Vec<MessageListItem>,
    pub total: i64,
    pub page: i64,
    pub size: i64,
}

/// 消费留言请求体
#[derive(Debug, Deserialize)]
pub struct ConsumeInput {
    pub id: i64,
}

/// 写入一条留言。`created_at` 由 DB 默认值填充（服务端 UTC）。
pub async fn insert_message(
    pool: &SqlitePool,
    site: &str,
    path: Option<&str>,
    nickname: &str,
    content: &str,
    ip: Option<&str>,
    ua: Option<&str>,
) -> AppResult<i64> {
    let result = sqlx::query(
        "INSERT INTO message (site, path, nickname, content, ip, ua)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(site)
    .bind(path)
    .bind(nickname)
    .bind(content)
    .bind(ip)
    .bind(ua)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

/// 按站点分页查询留言。
///
/// `consumed` 取值 "0" / "1" / "all"（其它值按 "0" 处理）。
/// 排序：created_at DESC, id DESC（最新优先）。
pub async fn query_messages(
    pool: &SqlitePool,
    site: &str,
    consumed: &str,
    page: i64,
    size: i64,
) -> AppResult<MessageListPage> {
    let page = page.max(1);
    let offset = (page - 1) * size;

    let items = match consumed {
        "all" => sqlx::query_as::<_, MessageListItem>(
            "SELECT id, site, path, nickname, content, consumed, created_at
             FROM message
             WHERE site = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?",
        ),
        "1" => sqlx::query_as::<_, MessageListItem>(
            "SELECT id, site, path, nickname, content, consumed, created_at
             FROM message
             WHERE site = ? AND consumed = 1
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?",
        ),
        _ => sqlx::query_as::<_, MessageListItem>(
            "SELECT id, site, path, nickname, content, consumed, created_at
             FROM message
             WHERE site = ? AND consumed = 0
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?",
        ),
    }
    .bind(site)
    .bind(size)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let total: i64 = match consumed {
        "all" => sqlx::query_scalar("SELECT COUNT(*) FROM message WHERE site = ?"),
        "1" => {
            sqlx::query_scalar("SELECT COUNT(*) FROM message WHERE site = ? AND consumed = 1")
        }
        _ => {
            sqlx::query_scalar("SELECT COUNT(*) FROM message WHERE site = ? AND consumed = 0")
        }
    }
    .bind(site)
    .fetch_one(pool)
    .await?;

    Ok(MessageListPage {
        items,
        total,
        page,
        size,
    })
}

/// 标记留言为已消费（软删除）。返回是否实际更新了一行。
pub async fn consume_message(pool: &SqlitePool, id: i64) -> AppResult<bool> {
    let result = sqlx::query("UPDATE message SET consumed = 1 WHERE id = ? AND consumed = 0")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

#[cfg(all(test, feature = "test-utils"))]
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
            display: None,
            identifier: None,
            description: None,
            changelog: Some("v1".to_string()),
            force: None,
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
            save_version(
                &pool,
                &GithubPublishInput {
                    name: name.to_string(),
                    version: "0.1.0".to_string(),
                    download_url: format!("https://github.com/test/{}-0.1.0.exe", name),
                    display: None,
                    identifier: None,
                    description: None,
                    changelog: None,
                    force: None,
                },
            )
            .await
            .unwrap();
        }
        let list = list_all_software(&pool).await.unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|s| s.versions.len() == 1));
    }

    #[tokio::test]
    async fn test_get_latest_version() {
        let pool = setup_test_db().await;
        save_version(
            &pool,
            &GithubPublishInput {
                name: "toolbox".to_string(),
                version: "0.1.0".to_string(),
                download_url: "https://github.com/test/v1.exe".to_string(),
                display: None,
                identifier: None,
                description: None,
                changelog: None,
                force: None,
            },
        )
        .await
        .unwrap();
        save_version(
            &pool,
            &GithubPublishInput {
                name: "toolbox".to_string(),
                version: "0.2.0".to_string(),
                download_url: "https://github.com/test/v2.exe".to_string(),
                display: None,
                identifier: None,
                description: None,
                changelog: None,
                force: None,
            },
        )
        .await
        .unwrap();

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

    #[tokio::test]
    async fn test_insert_and_query_page_view() {
        let pool = setup_test_db().await;
        // 同一 visitor_hash 访问同一 path 3 次 -> PV=3, UV=1
        for _ in 0..3 {
            insert_page_view(
                &pool,
                "blog",
                "/",
                "hash1",
                Some("1.2.3.4"),
                Some("Mozilla/5.0"),
                None,
                Some("desktop"),
            )
            .await
            .unwrap();
        }
        // 不同 visitor 访问 /about
        insert_page_view(
            &pool,
            "blog",
            "/about",
            "hash2",
            Some("1.2.3.5"),
            Some("curl/8"),
            None,
            Some("bot"),
        )
        .await
        .unwrap();

        let overview = query_overview(&pool, "blog", "2000-01-01", "2999-01-01", "day")
            .await
            .unwrap();
        let total_pv: i64 = overview.iter().map(|p| p.pv).sum();
        let total_uv: i64 = overview.iter().map(|p| p.uv).sum();
        assert_eq!(total_pv, 4);
        assert_eq!(total_uv, 2);

        let paths = query_top_paths(&pool, "blog", "2000-01-01", "2999-01-01", 10)
            .await
            .unwrap();
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].key.as_deref(), Some("/"));
        assert_eq!(paths[0].count, 3);

        let devs = query_top_sources(&pool, "blog", "2000-01-01", "2999-01-01", "device", 10)
            .await
            .unwrap();
        assert!(devs.iter().any(|d| d.key.as_deref() == Some("desktop")));
        assert!(devs.iter().any(|d| d.key.as_deref() == Some("bot")));
    }
}
