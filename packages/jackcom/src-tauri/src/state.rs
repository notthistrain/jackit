use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::channel::BrokerHandle;
use crate::serial::config::SerialConfig;
use crate::serial::manager::SerialManager;

/// 全局应用状态
pub struct AppState {
    /// 已打开的串口连接配置（port_name → config）
    pub connections: DashMap<String, SerialConfig>,
    /// 数据库连接池
    pub db: Arc<RwLock<Option<SqlitePool>>>,
    /// 串口管理器：负责打开/关闭/发送/接收
    pub serial_manager: Arc<SerialManager>,
    /// Broker 句柄：用于发布事件
    pub broker_handle: BrokerHandle,
    /// 活跃会话映射（port_name → session_id）
    pub sessions: DashMap<String, i64>,
}

impl AppState {
    pub fn new(serial_manager: Arc<SerialManager>, broker_handle: BrokerHandle) -> Self {
        Self {
            connections: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
            serial_manager,
            broker_handle,
            sessions: DashMap::new(),
        }
    }

    /// 测试用构造函数
    #[cfg(test)]
    pub fn new_test() -> Self {
        let broker_handle = BrokerHandle::new_test();
        let serial_manager = Arc::new(SerialManager::new(broker_handle.clone()));
        Self {
            connections: DashMap::new(),
            db: Arc::new(RwLock::new(None)),
            serial_manager,
            broker_handle,
            sessions: DashMap::new(),
        }
    }
}
