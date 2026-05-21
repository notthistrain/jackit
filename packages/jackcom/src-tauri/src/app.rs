use std::sync::Arc;
use std::time::Duration;

use crate::logging::{self, LogGuard};
use crate::services::event_bus::EventBus;
use crate::services::serial_state::SerialState;
use crate::services::storage_state::StorageState;
use crate::infra::db::pool;
use crate::infra::watcher::watcher::PortWatcher;

/// 构建 App -- 按依赖顺序初始化
///
/// 返回 (LogGuard, SerialState, StorageState)
/// LogGuard 必须注册为 Tauri managed state 保持存活
pub async fn build_app(app_handle: tauri::AppHandle) -> anyhow::Result<(LogGuard, SerialState, StorageState)> {
    // 1. 日志（guard 必须在 main 作用域存活）
    let log_guard = logging::init_logging("jackcom");

    // 2. DB（失败 -> 应用启动失败）
    let db_pool = pool::init_db().await?;
    let storage_state = StorageState::new(db_pool);

    // 3. 共享 session 映射（SerialState 和 db_writer 都需要）
    let sessions = Arc::new(dashmap::DashMap::new());

    // 4. EventBus -- 核心枢纽
    let event_bus = Arc::new(EventBus::new(256));

    // 5. 启动独立消费者
    crate::services::tauri_bridge::spawn(
        event_bus.subscribe(),
        app_handle,
        Duration::from_millis(10),
    );
    crate::services::db_writer::spawn(
        event_bus.subscribe(),
        storage_state.pool().clone(),
        100,
        Duration::from_millis(500),
        sessions.clone(),
    );

    // 6. 启动端口热插拔检测
    spawn_watcher(event_bus.emitter());

    // 7. SerialState
    let serial_state = SerialState::new(event_bus.emitter(), sessions);

    Ok((log_guard, serial_state, storage_state))
}

fn spawn_watcher(emitter: crate::services::emitter::EventEmitter) {
    tokio::spawn(async move {
        let mut watcher = PortWatcher::new(Duration::from_secs(2));
        watcher.initialize();
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let change = watcher.scan_once();
            if !change.arrived.is_empty() || !change.removed.is_empty() {
                emitter.emit_change(change.arrived, change.removed);
            }
        }
    });
}
