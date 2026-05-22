use bytes::Bytes;
use sqlx::SqlitePool;

use crate::core::protocol::frame::ParsedFrame;
use crate::core::protocol::parsers::raw::RawParser;
use crate::core::protocol::traits::ProtocolParser;
use crate::core::protocol::types::ProtocolType;
use crate::core::serial::config::SerialConfig;
use crate::core::serial::types::{Direction, PortName};
use crate::infra::db::session_repo;
use crate::services::port_task::PortTask;
use crate::services::serial_state::{PortEntry, SerialState};

/// 打开端口
pub async fn open(
    state: &SerialState,
    pool: &SqlitePool,
    config: &SerialConfig,
) -> anyhow::Result<PortName> {
    let port_name = PortName::new(&config.port_name);

    if state.is_port_open(&port_name) {
        anyhow::bail!("端口已被占用: {}", port_name);
    }

    // 打开串口（直接使用 serialport 类型，无需映射）
    let port = serialport::new(&config.port_name, config.baud_rate)
        .data_bits(config.data_bits)
        .stop_bits(config.stop_bits)
        .parity(config.parity)
        .flow_control(config.flow_control)
        .open()
        .map_err(|e| anyhow::anyhow!("打开串口失败: {e}"))?;

    // 创建 session
    let session_id = session_repo::create_session(pool, &port_name, config.baud_rate).await?;

    // 启动 PortTask
    let task = PortTask::start(port, port_name.clone(), state.emitter().clone())?;

    // 发布 Opened 事件
    state
        .emitter()
        .emit_opened(port_name.clone(), config.clone());

    // 存入状态
    state.insert_port(
        port_name.clone(),
        PortEntry {
            port_name: port_name.clone(),
            task,
            session_id,
        },
    );

    Ok(port_name)
}

/// 关闭端口
pub async fn close(
    state: &SerialState,
    pool: &SqlitePool,
    port_name: &PortName,
) -> anyhow::Result<()> {
    let Some((_, entry)) = state.remove_port(port_name) else {
        anyhow::bail!("端口不存在: {}", port_name);
    };

    // 结束 session
    session_repo::end_session(pool, entry.session_id).await?;

    // 停止任务
    entry.task.stop().await;

    // 发布 Closed 事件
    state.emitter().emit_closed(
        port_name.clone(),
        crate::core::serial::config::CloseReason::Disconnected,
    );

    Ok(())
}

/// 关闭所有端口
pub async fn close_all(state: &SerialState, pool: &SqlitePool) -> Vec<PortName> {
    let port_names: Vec<PortName> = state.open_port_names();
    for name in &port_names {
        let _ = close(state, pool, name).await;
    }
    port_names
}

/// 发送数据
pub fn send(state: &SerialState, port_name: &PortName, data: Vec<u8>) -> anyhow::Result<usize> {
    let Some(entry) = state.get_port(port_name) else {
        anyhow::bail!("端口不存在: {}", port_name);
    };
    let len = data.len();
    let raw = Bytes::from(data.clone());
    let parsed = RawParser.parse(&data).unwrap();
    let frame = ParsedFrame::new(raw, ProtocolType::Raw, parsed);
    entry.task.send(data)?;
    // 发布 TX 事件（含实际数据，前端回显）
    state
        .emitter()
        .emit_data(port_name.clone(), vec![frame], Direction::Tx);
    Ok(len)
}
