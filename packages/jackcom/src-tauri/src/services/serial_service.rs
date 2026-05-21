use sqlx::SqlitePool;

use crate::core::serial::config::SerialConfig;
use crate::core::serial::types::PortName;
use crate::infra::db::session_repo;
use crate::services::serial_state::{PortEntry, SerialState};
use crate::services::port_task::PortTask;

/// 串口服务 -- 端口生命周期管理
pub struct SerialService;

impl SerialService {
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

        // 打开串口
        let port = serialport::new(&config.port_name, config.baud_rate)
            .data_bits(map_data_bits(config.data_bits))
            .stop_bits(map_stop_bits(config.stop_bits))
            .parity(map_parity(config.parity))
            .flow_control(map_flow_control(config.flow_control))
            .open()
            .map_err(|e| anyhow::anyhow!("打开串口失败: {e}"))?;

        // 创建 session
        let session_id = session_repo::create_session(pool, &port_name, config.baud_rate).await?;
        state.sessions.insert(port_name.clone(), session_id);

        // 启动 PortTask
        let task = PortTask::start(
            port,
            port_name.clone(),
            state.emitter.clone(),
        )?;

        // 发布 Opened 事件
        state.emitter.emit_opened(port_name.clone(), config.clone());

        // 存入状态
        state.ports.insert(port_name.clone(), PortEntry {
            port_name: port_name.clone(),
            task,
            session_id,
        });

        Ok(port_name)
    }

    /// 关闭端口
    pub async fn close(
        state: &SerialState,
        pool: &SqlitePool,
        port_name: &PortName,
    ) -> anyhow::Result<()> {
        let Some((_, entry)) = state.ports.remove(port_name) else {
            anyhow::bail!("端口不存在: {}", port_name);
        };

        // 结束 session
        session_repo::end_session(pool, entry.session_id).await?;
        state.sessions.remove(port_name);

        // 停止任务
        entry.task.stop().await;

        // 发布 Closed 事件
        state.emitter.emit_closed(
            port_name.clone(),
            crate::core::serial::config::CloseReason::Disconnected,
        );

        Ok(())
    }

    /// 关闭所有端口
    pub async fn close_all(state: &SerialState, pool: &SqlitePool) -> Vec<PortName> {
        let port_names: Vec<PortName> = state.ports.iter().map(|r| r.key().clone()).collect();
        for name in &port_names {
            let _ = Self::close(state, pool, name).await;
        }
        port_names
    }

    /// 发送数据
    pub fn send(state: &SerialState, port_name: &PortName, data: Vec<u8>) -> anyhow::Result<usize> {
        let Some(entry) = state.ports.get(port_name) else {
            anyhow::bail!("端口不存在: {}", port_name);
        };
        let len = data.len();
        entry.task.send(data)?;
        // 发布 TX 事件
        state.emitter.emit_data(
            port_name.clone(),
            vec![],
            crate::core::serial::types::Direction::Tx,
        );
        Ok(len)
    }
}

// -- 类型映射 --

fn map_data_bits(v: crate::core::serial::config::DataBits) -> serialport::DataBits {
    match v {
        crate::core::serial::config::DataBits::Five => serialport::DataBits::Five,
        crate::core::serial::config::DataBits::Six => serialport::DataBits::Six,
        crate::core::serial::config::DataBits::Seven => serialport::DataBits::Seven,
        crate::core::serial::config::DataBits::Eight => serialport::DataBits::Eight,
    }
}

fn map_stop_bits(v: crate::core::serial::config::StopBits) -> serialport::StopBits {
    match v {
        crate::core::serial::config::StopBits::One => serialport::StopBits::One,
        crate::core::serial::config::StopBits::Two => serialport::StopBits::Two,
    }
}

fn map_parity(v: crate::core::serial::config::Parity) -> serialport::Parity {
    match v {
        crate::core::serial::config::Parity::None => serialport::Parity::None,
        crate::core::serial::config::Parity::Odd => serialport::Parity::Odd,
        crate::core::serial::config::Parity::Even => serialport::Parity::Even,
    }
}

fn map_flow_control(v: crate::core::serial::config::FlowControl) -> serialport::FlowControl {
    match v {
        crate::core::serial::config::FlowControl::None => serialport::FlowControl::None,
        crate::core::serial::config::FlowControl::Hardware => serialport::FlowControl::Hardware,
        crate::core::serial::config::FlowControl::Software => serialport::FlowControl::Software,
    }
}
