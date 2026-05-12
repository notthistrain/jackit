use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::serial::SerialConfig;

/// 全局应用状态
pub struct AppState {
    /// 已打开的串口连接（port_name → config）
    pub connections: DashMap<String, SerialConfig>,
    /// 数据库连接池
    pub db: Arc<RwLock<Option<SqlitePool>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
        }
    }
}
