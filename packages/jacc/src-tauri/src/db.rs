use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::collections::HashMap;
use std::path::PathBuf;

/// 获取数据库文件路径: ~/.jackit/toolbox/tools/jacc/data/jacc.db
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".jackit").join("toolbox").join("tools").join("jacc").join("data");
    std::fs::create_dir_all(&dir).ok();
    dir.join("jacc.db")
}

pub async fn init_pool() -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path();
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    // 新表：providers
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    // 新表：api_keys
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            api_key TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // model_slots 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS model_slots (
            slot TEXT PRIMARY KEY,
            model_id INTEGER NOT NULL,
            context_size TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // projects 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            name TEXT,
            last_opened_at TEXT DEFAULT (datetime('now')),
            pinned INTEGER DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    // preferences 表（不变）
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // 检查是否需要从旧扁平 schema 迁移
    let models_exists: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='models'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0) > 0;

    if models_exists {
        let has_base_url: bool = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM pragma_table_info('models') WHERE name = 'base_url'",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0) > 0;

        if has_base_url {
            migrate_flat_models(pool).await?;
        }
    } else {
        // 全新安装，创建新的 models 表
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            )",
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// 旧版扁平 models 表行结构（仅迁移用）
#[derive(sqlx::FromRow)]
struct OldModel {
    id: i64,
    alias: String,
    base_url: String,
    api_key: String,
    model_name: String,
    context_size: Option<String>,
}

/// 将旧版扁平 models 表迁移为 Provider -> APIKey -> Model 三层结构
async fn migrate_flat_models(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // 暂时禁用外键，避免 RENAME/DROP 触发 CASCADE 删除
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(pool)
        .await?;

    // 1. 重命名旧表
    sqlx::query("ALTER TABLE models RENAME TO models_old")
        .execute(pool)
        .await?;

    // 2. 创建新 models 表
    sqlx::query(
        "CREATE TABLE models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            context_size TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // 3. 读取所有旧数据
    let old_models = sqlx::query_as::<_, OldModel>(
        "SELECT id, alias, base_url, api_key, model_name, context_size FROM models_old ORDER BY id",
    )
    .fetch_all(pool)
    .await?;

    // 4. 按 base_url 分组创建 Provider
    let mut provider_map: HashMap<String, i64> = HashMap::new();
    for m in &old_models {
        if !provider_map.contains_key(&m.base_url) {
            let id = sqlx::query("INSERT INTO providers (name, base_url) VALUES (?, ?)")
                .bind(format!("{} Provider", m.alias))
                .bind(&m.base_url)
                .execute(pool)
                .await?
                .last_insert_rowid();
            provider_map.insert(m.base_url.clone(), id);
        }
    }

    // 5. 为每行旧数据创建 APIKey + Model，建立 id 映射
    let mut id_map: HashMap<i64, i64> = HashMap::new();
    for m in &old_models {
        let provider_id = provider_map[&m.base_url];

        let ak_id = sqlx::query(
            "INSERT INTO api_keys (provider_id, name, api_key) VALUES (?, ?, ?)",
        )
        .bind(provider_id)
        .bind(format!("{} Key", m.alias))
        .bind(&m.api_key)
        .execute(pool)
        .await?
        .last_insert_rowid();

        let new_id = sqlx::query(
            "INSERT INTO models (api_key_id, model_name, context_size) VALUES (?, ?, ?)",
        )
        .bind(ak_id)
        .bind(&m.model_name)
        .bind(&m.context_size)
        .execute(pool)
        .await?
        .last_insert_rowid();

        id_map.insert(m.id, new_id);
    }

    // 6. 更新 model_slots 的 model_id
    for (old_id, new_id) in &id_map {
        sqlx::query("UPDATE model_slots SET model_id = ? WHERE model_id = ?")
            .bind(new_id)
            .bind(old_id)
            .execute(pool)
            .await?;
    }

    // 7. 删除旧表
    sqlx::query("DROP TABLE models_old")
        .execute(pool)
        .await?;

    // 重新启用外键
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    /// 创建旧版扁平 schema（模拟升级前状态）
    async fn setup_old_schema() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();

        // providers 和 api_keys 表（migrate_flat_models 依赖它们已存在）
        sqlx::query(
            "CREATE TABLE providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        // 旧版扁平 models 表
        sqlx::query(
            "CREATE TABLE models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alias TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                context_size TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE model_slots (
                slot TEXT PRIMARY KEY,
                model_id INTEGER NOT NULL,
                context_size TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_migrate_flat_to_hierarchy() {
        let pool = setup_old_schema().await;

        // 插入旧数据：两个模型共享同一个 base_url
        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name, context_size)
             VALUES ('Anthropic Opus', 'https://api.anthropic.com', 'sk-ant-aaa', 'claude-opus-4-6', '200k')",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('Anthropic Sonnet', 'https://api.anthropic.com', 'sk-ant-bbb', 'claude-sonnet-4-6')",
        )
        .execute(&pool)
        .await
        .unwrap();

        // 绑定 slot 到旧模型 id=1
        sqlx::query("INSERT INTO model_slots (slot, model_id) VALUES ('opus', 1)")
            .execute(&pool)
            .await
            .unwrap();

        // 运行迁移
        migrate_flat_models(&pool).await.unwrap();

        // 验证：1 个 provider（共享 base_url）
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);

        let (_name, base_url): (String, String) =
            sqlx::query_as("SELECT name, base_url FROM providers LIMIT 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(base_url, "https://api.anthropic.com");

        // 验证：2 个 api_key
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM api_keys")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);

        // 验证：2 个 model
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM models")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);

        // 验证：model_slots 仍然有效（model_id 已更新）
        let (slot, model_name): (String, String) = sqlx::query_as(
            "SELECT ms.slot, m.model_name
             FROM model_slots ms JOIN models m ON ms.model_id = m.id
             WHERE ms.slot = 'opus'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(slot, "opus");
        assert_eq!(model_name, "claude-opus-4-6");

        // 验证：旧表已删除
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='models_old'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_migrate_empty_old_table() {
        let pool = setup_old_schema().await;
        // 不插入任何数据
        migrate_flat_models(&pool).await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM models")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_migrate_different_providers() {
        let pool = setup_old_schema().await;

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('Anthropic', 'https://api.anthropic.com', 'sk-ant-aaa', 'claude-opus-4-6')",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO models (alias, base_url, api_key, model_name)
             VALUES ('DeepSeek', 'https://api.deepseek.com', 'ds-bbb', 'deepseek-v3')",
        )
        .execute(&pool)
        .await
        .unwrap();

        migrate_flat_models(&pool).await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);
    }
}
