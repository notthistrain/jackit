use sqlx::SqlitePool;
use std::sync::Arc;

/// 存储状态 -- DB 连接池包装
pub struct StorageState {
    pool: Arc<SqlitePool>,
}

impl StorageState {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool: Arc::new(pool) }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn pool_arc(&self) -> Arc<SqlitePool> {
        self.pool.clone()
    }
}
