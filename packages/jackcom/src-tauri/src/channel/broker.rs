use std::collections::HashMap;

use tokio::sync::mpsc;

use super::PortEvent;
use super::backpressure::BackpressureStrategy;
use crate::protocol::frame::ParsedFrame;
use crate::serial::config::{CloseReason, SerialConfig};

/// Broker 句柄：轻量级事件发布器
///
/// 包装 mpsc::Sender<PortEvent>，提供便捷的事件发布方法。
/// 可克隆，多个端口 task 可共享。
#[derive(Clone)]
pub struct BrokerHandle {
    tx: mpsc::Sender<PortEvent>,
}

impl BrokerHandle {
    /// 从 source 通道创建句柄
    pub fn new(tx: mpsc::Sender<PortEvent>) -> Self {
        Self { tx }
    }

    /// 创建用于测试的句柄（事件被丢弃）
    #[cfg(test)]
    pub fn new_test() -> Self {
        let (tx, _rx) = mpsc::channel(1);
        Self { tx }
    }

    /// 发布数据帧事件
    pub fn publish_data(&self, port_id: &str, frames: Vec<ParsedFrame>) {
        if let Err(e) = self.tx.try_send(PortEvent::Data {
            port_id: port_id.to_string(),
            frames,
        }) {
            tracing::warn!("Broker: 数据事件发布失败 (port={}): {}", port_id, e);
        }
    }

    /// 发布端口打开事件
    pub fn publish_port_opened(&self, port_id: &str, config: &SerialConfig) {
        if let Err(e) = self.tx.try_send(PortEvent::Opened {
            port_id: port_id.to_string(),
            config: config.clone(),
        }) {
            tracing::warn!("Broker: 端口打开事件发布失败 (port={}): {}", port_id, e);
        }
    }

    /// 发布端口关闭事件
    pub fn publish_port_closed(&self, port_id: &str, reason: CloseReason) {
        if let Err(e) = self.tx.try_send(PortEvent::Closed {
            port_id: port_id.to_string(),
            reason,
        }) {
            tracing::warn!("Broker: 端口关闭事件发布失败 (port={}): {}", port_id, e);
        }
    }

    /// 发布端口错误事件
    pub fn publish_error(&self, port_id: &str, error: &str) {
        if let Err(e) = self.tx.try_send(PortEvent::Error {
            port_id: port_id.to_string(),
            error: error.to_string(),
        }) {
            tracing::warn!("Broker: 端口错误事件发布失败 (port={}): {}", port_id, e);
        }
    }

    /// 发布端口列表变更事件
    pub fn publish_change(&self, arrived: Vec<String>, removed: Vec<String>) {
        if let Err(e) = self.tx.try_send(PortEvent::Change { arrived, removed }) {
            tracing::warn!("Broker: 端口变更事件发布失败: {}", e);
        }
    }
}

/// 订阅者信息
struct Subscriber {
    sender: mpsc::Sender<PortEvent>,
    strategy: BackpressureStrategy,
    /// 降采样计数器（当前端满时使用）
    sample_counter: u32,
}

/// 发布/订阅消息代理
pub struct Broker {
    /// 事件来源（串口层推入）
    source: mpsc::Receiver<PortEvent>,
    /// 所有订阅者
    subscribers: HashMap<String, Subscriber>,
    /// 订阅者通道容量
    channel_capacity: usize,
}

impl Broker {
    /// 创建 Broker
    ///
    /// - `source`: 串口层事件接收端
    /// - `channel_capacity`: 每个 subscriber 通道容量
    pub fn new(source: mpsc::Receiver<PortEvent>, channel_capacity: usize) -> Self {
        Self {
            source,
            subscribers: HashMap::new(),
            channel_capacity,
        }
    }

    /// 订阅：返回事件接收端
    pub fn subscribe(&mut self, id: String) -> mpsc::Receiver<PortEvent> {
        self.subscribe_with_strategy(id, BackpressureStrategy::DropNewest)
    }

    /// 订阅（指定背压策略）
    pub fn subscribe_with_strategy(
        &mut self,
        id: String,
        strategy: BackpressureStrategy,
    ) -> mpsc::Receiver<PortEvent> {
        let (tx, rx) = mpsc::channel(self.channel_capacity);
        self.subscribers.insert(
            id,
            Subscriber {
                sender: tx,
                strategy,
                sample_counter: 0,
            },
        );
        rx
    }

    /// 取消订阅
    pub fn unsubscribe(&mut self, id: &str) -> bool {
        self.subscribers.remove(id).is_some()
    }

    /// 当前订阅者数量
    pub fn subscriber_count(&self) -> usize {
        self.subscribers.len()
    }

    /// 运行 Broker 主循环
    ///
    /// 从 source 取事件，应用背压策略后广播到所有 subscriber。
    /// 使用 batch_interval_ms 控制批量合并间隔：Data 事件会缓冲，
    /// timer 到期时合并同端口的帧一起分发，减少前端重渲染次数。
    pub async fn run(mut self, batch_interval_ms: u64) {
        let mut interval = tokio::time::interval(
            std::time::Duration::from_millis(batch_interval_ms)
        );
        interval.tick().await; // 第一次立即完成

        // 批量缓冲区：按 port_id 合并 Data 事件的帧
        let mut pending_data: HashMap<String, Vec<ParsedFrame>> = HashMap::new();

        loop {
            tokio::select! {
                event = self.source.recv() => {
                    match event {
                        Some(e) => {
                            match e {
                                PortEvent::Data { port_id, frames } => {
                                    // 缓冲 Data 事件，等待 timer 合并
                                    pending_data
                                        .entry(port_id)
                                        .or_default()
                                        .extend(frames);
                                }
                                _ => {
                                    // 非数据事件立即分发
                                    self.dispatch_event(e);
                                }
                            }
                        }
                        None => {
                            // source 关闭前 flush 剩余缓冲
                            self.flush_pending_data(&mut pending_data);
                            break;
                        }
                    }
                }
                _ = interval.tick() => {
                    // 批量间隔到期，flush 缓冲的 Data 事件
                    self.flush_pending_data(&mut pending_data);
                }
            }
        }
    }

    /// 将缓冲的 Data 事件按 port_id 合并分发
    fn flush_pending_data(&mut self, pending: &mut HashMap<String, Vec<ParsedFrame>>) {
        if pending.is_empty() {
            return;
        }
        // 取出所有缓冲数据
        let drained: Vec<(String, Vec<ParsedFrame>)> = pending.drain().collect();
        for (port_id, frames) in drained {
            self.dispatch_event(PortEvent::Data { port_id, frames });
        }
    }

    /// 分发事件到所有订阅者（应用背压策略），清理已关闭的 subscriber
    fn dispatch_event(&mut self, event: PortEvent) {
        let mut closed_ids: Vec<String> = Vec::new();

        for (id, sub) in self.subscribers.iter_mut() {
            let should_send = match &sub.strategy {
                BackpressureStrategy::DropNewest => {
                    true
                }
                BackpressureStrategy::Downsample { every_n } => {
                    sub.sample_counter += 1;
                    if sub.sample_counter >= *every_n {
                        sub.sample_counter = 0;
                        true
                    } else {
                        false
                    }
                }
                BackpressureStrategy::BufferLatest => {
                    true
                }
            };

            if should_send {
                match sub.sender.try_send(event.clone()) {
                    Ok(()) => {}
                    Err(mpsc::error::TrySendError::Full(_)) => {
                        match &sub.strategy {
                            BackpressureStrategy::DropNewest => {}
                            BackpressureStrategy::Downsample { .. } => {
                                sub.sample_counter = 0;
                            }
                            BackpressureStrategy::BufferLatest => {
                                let _ = sub.sender.try_send(event.clone());
                            }
                        }
                    }
                    Err(mpsc::error::TrySendError::Closed(_)) => {
                        closed_ids.push(id.clone());
                    }
                }
            }
        }

        // 清理已关闭的 subscriber
        if !closed_ids.is_empty() {
            tracing::debug!("Broker: 清理 {} 个已关闭的 subscriber", closed_ids.len());
            for id in &closed_ids {
                self.subscribers.remove(id);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::serial::config::CloseReason;
    use bytes::Bytes;
    use chrono::Utc;
    use crate::protocol::frame::{Direction, RawFrame, ParsedFrame};
    use crate::protocol::{ProtocolType, ParsedData};

    fn make_data_event(port_id: &str, data: &[u8]) -> PortEvent {
        let hex: String = data.iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        let ascii: String = data.iter()
            .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
            .collect();
        PortEvent::Data {
            port_id: port_id.to_string(),
            frames: vec![ParsedFrame {
                raw: RawFrame {
                    port_id: port_id.to_string(),
                    timestamp: Utc::now(),
                    data: Bytes::from(data.to_vec()),
                    direction: Direction::Rx,
                },
                protocol: ProtocolType::Raw,
                parsed: ParsedData::Raw { hex, ascii },
                formatted: format!("{:02X?}", data),
            }],
        }
    }

    #[tokio::test]
    async fn subscribe_and_receive_event() {
        let (tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        let mut sub_rx = broker.subscribe("main".to_string());
        assert_eq!(broker.subscriber_count(), 1);

        // 发送事件
        let event = make_data_event("COM3", b"\x01\x02");
        tx.send(event.clone()).await.unwrap();
        drop(tx); // 关闭 source，触发 broker 退出

        // 在后台运行 broker
        tokio::spawn(async move {
            broker.run(10).await;
        });

        // subscriber 应收到事件
        let received = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub_rx.recv()
        ).await.unwrap().unwrap();

        if let PortEvent::Data { port_id, .. } = received {
            assert_eq!(port_id, "COM3");
        } else {
            panic!("Expected Data event");
        }
    }

    #[tokio::test]
    async fn multiple_subscribers_all_receive() {
        let (tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        let mut sub1 = broker.subscribe("main".to_string());
        let mut sub2 = broker.subscribe("waveform".to_string());
        assert_eq!(broker.subscriber_count(), 2);

        let event = make_data_event("COM3", b"\xAA");
        tx.send(event).await.unwrap();
        drop(tx);

        tokio::spawn(async move {
            broker.run(10).await;
        });

        let r1 = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub1.recv()
        ).await.unwrap().unwrap();

        let r2 = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub2.recv()
        ).await.unwrap().unwrap();

        assert!(matches!(r1, PortEvent::Data { .. }));
        assert!(matches!(r2, PortEvent::Data { .. }));
    }

    #[tokio::test]
    async fn unsubscribe_removes_subscriber() {
        let (_tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        broker.subscribe("main".to_string());
        assert_eq!(broker.subscriber_count(), 1);

        assert!(broker.unsubscribe("main"));
        assert_eq!(broker.subscriber_count(), 0);
        assert!(!broker.unsubscribe("main")); // 二次移除返回 false
    }

    #[tokio::test]
    async fn closed_event_dispatches_to_all() {
        let (tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        let mut sub1 = broker.subscribe("main".to_string());
        let mut sub2 = broker.subscribe("decoder".to_string());

        let event = PortEvent::Closed {
            port_id: "COM3".to_string(),
            reason: CloseReason::Error,
        };
        tx.send(event).await.unwrap();
        drop(tx);

        tokio::spawn(async move {
            broker.run(10).await;
        });

        let r1 = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub1.recv()
        ).await.unwrap();
        let r2 = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub2.recv()
        ).await.unwrap();

        assert!(matches!(r1, Some(PortEvent::Closed { .. })));
        assert!(matches!(r2, Some(PortEvent::Closed { .. })));
    }

    #[tokio::test]
    async fn broker_exits_when_source_closed() {
        let (tx, rx) = mpsc::channel::<PortEvent>(16);
        let broker = Broker::new(rx, 16);

        drop(tx); // 立即关闭 source

        // run 应该很快返回
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            broker.run(10)
        ).await;

        assert!(result.is_ok(), "Broker should exit when source closes");
    }

    #[tokio::test]
    async fn subscribe_with_custom_strategy() {
        let (_tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        let _sub = broker.subscribe_with_strategy(
            "main".to_string(),
            BackpressureStrategy::Downsample { every_n: 5 },
        );
        assert_eq!(broker.subscriber_count(), 1);
    }

    #[tokio::test]
    async fn stats_event_dispatches() {
        let (tx, rx) = mpsc::channel::<PortEvent>(16);
        let mut broker = Broker::new(rx, 16);

        let mut sub = broker.subscribe("main".to_string());

        let event = PortEvent::Stats {
            port_id: "COM3".to_string(),
            rx: 9999,
            tx: 8888,
            fps: 120,
        };
        tx.send(event).await.unwrap();
        drop(tx);

        tokio::spawn(async move {
            broker.run(10).await;
        });

        let received = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            sub.recv()
        ).await.unwrap().unwrap();

        if let PortEvent::Stats { rx, tx, fps, .. } = received {
            assert_eq!(rx, 9999);
            assert_eq!(tx, 8888);
            assert_eq!(fps, 120);
        } else {
            panic!("Expected Stats event");
        }
    }
}
