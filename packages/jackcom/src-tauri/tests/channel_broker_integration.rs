use bytes::Bytes;
use chrono::Utc;
use tokio::sync::mpsc;

use upgrade_component_jackcom_lib::channel::broker::Broker;
use upgrade_component_jackcom_lib::channel::backpressure::BackpressureStrategy;
use upgrade_component_jackcom_lib::channel::PortEvent;
use upgrade_component_jackcom_lib::protocol::frame::{Direction, RawFrame, ParsedFrame};
use upgrade_component_jackcom_lib::protocol::{ProtocolType, ParsedData};

fn make_data_event(port_id: &str, seq: u8) -> PortEvent {
    let data = vec![seq];
    let hex = format!("{:02X}", seq);
    let ascii: String = data.iter()
        .map(|&b| if b >= 0x20 && b < 0x7F { b as char } else { '.' })
        .collect();
    PortEvent::Data {
        port_id: port_id.to_string(),
        frames: vec![ParsedFrame {
            raw: RawFrame {
                port_id: port_id.to_string(),
                timestamp: Utc::now(),
                data: Bytes::from(data),
                direction: Direction::Rx,
            },
            protocol: ProtocolType::Raw,
            parsed: ParsedData::Raw { hex, ascii },
            formatted: format!("{:02X}", seq),
        }],
    }
}

#[tokio::test]
async fn drop_newest_does_not_block_under_high_frequency() {
    // subscriber 容量只有 10，发送 50 个事件
    // 使用不同端口 ID 确保产生 50 个独立事件（不被批量合并）
    let (tx, rx) = mpsc::channel::<PortEvent>(256);
    let mut broker = Broker::new(rx, 10); // subscriber 容量 10

    let mut sub = broker.subscribe("main".to_string());

    // 先发送 50 个事件到 source（不同端口 ID）
    for i in 0..50u8 {
        let event = make_data_event(&format!("COM{}", i), i);
        tx.send(event).await.unwrap();
    }
    drop(tx); // 关闭 source

    // 运行 broker
    tokio::spawn(async move {
        broker.run(5).await;
    });

    // 给 broker 时间处理
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // subscriber 应收到部分事件（10 个或更少），不应死锁
    let mut received_count = 0;
    while let Ok(Some(_)) = tokio::time::timeout(
        std::time::Duration::from_millis(50),
        sub.recv()
    ).await {
        received_count += 1;
    }

    // 不应死锁，应收到 <= 12 个（通道容量 + 少量缓冲）
    assert!(received_count <= 12, "Should receive at most channel capacity, got {}", received_count);
    assert!(received_count > 0, "Should receive at least some events");
}

#[tokio::test]
async fn downsample_reduces_event_count() {
    // 使用不同端口 ID 发送事件，避免批量合并将它们合并为一个事件
    let (tx, rx) = mpsc::channel::<PortEvent>(256);
    let mut broker = Broker::new(rx, 256);

    let mut sub = broker.subscribe_with_strategy(
        "waveform".to_string(),
        BackpressureStrategy::Downsample { every_n: 10 },
    );

    // 发送 100 个事件，使用不同端口 ID 避免合并
    for i in 0..100u8 {
        let event = make_data_event(&format!("COM{}", i), i);
        tx.send(event).await.unwrap();
    }
    drop(tx);

    tokio::spawn(async move {
        broker.run(5).await;
    });

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let mut received_count = 0;
    while let Ok(Some(_event)) = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        sub.recv()
    ).await {
        received_count += 1;
    }

    // 每 10 帧取 1 帧，100 帧应该大约收到 10 个
    assert!(
        received_count <= 15,
        "Downsample(10) should reduce events to ~10, got {}",
        received_count
    );
    assert!(received_count >= 5, "Should receive some events, got {}", received_count);
}

#[tokio::test]
async fn multiple_subscribers_independent_strategies() {
    let (tx, rx) = mpsc::channel::<PortEvent>(256);
    let mut broker = Broker::new(rx, 256);

    let mut sub_main = broker.subscribe("main".to_string()); // DropNewest (default)
    let mut sub_wave = broker.subscribe_with_strategy(
        "waveform".to_string(),
        BackpressureStrategy::Downsample { every_n: 5 },
    );

    // 使用不同端口 ID 避免批量合并
    for i in 0..50u8 {
        let event = make_data_event(&format!("COM{}", i), i);
        tx.send(event).await.unwrap();
    }
    drop(tx);

    tokio::spawn(async move {
        broker.run(5).await;
    });

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // main subscriber 应收到全部 50 个（通道容量够大，DropNewest 不丢帧）
    let mut main_count = 0;
    while let Ok(Some(_)) = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        sub_main.recv()
    ).await {
        main_count += 1;
    }
    assert_eq!(main_count, 50, "main subscriber should receive all 50 events");

    // waveform subscriber 应收到约 10 个
    let mut wave_count = 0;
    while let Ok(Some(_)) = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        sub_wave.recv()
    ).await {
        wave_count += 1;
    }
    assert!(
        wave_count <= 15,
        "waveform subscriber should receive ~10 events, got {}",
        wave_count
    );
}

#[tokio::test]
async fn change_event_broadcasts_to_all_subscribers() {
    let (tx, rx) = mpsc::channel::<PortEvent>(16);
    let mut broker = Broker::new(rx, 16);

    let mut sub1 = broker.subscribe("main".to_string());
    let mut sub2 = broker.subscribe("decoder".to_string());

    let event = PortEvent::Change {
        arrived: vec!["COM4".to_string(), "COM5".to_string()],
        removed: vec!["COM3".to_string()],
    };
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

    if let PortEvent::Change { arrived, removed } = r1 {
        assert_eq!(arrived, vec!["COM4", "COM5"]);
        assert_eq!(removed, vec!["COM3"]);
    } else {
        panic!("Expected Change event");
    }
    assert!(matches!(r2, PortEvent::Change { .. }));
}

#[tokio::test]
async fn dynamic_subscribe_unsubscribe() {
    let (tx, rx) = mpsc::channel::<PortEvent>(32);
    let mut broker = Broker::new(rx, 32);

    let sub1 = broker.subscribe("main".to_string());
    let sub2 = broker.subscribe("temp".to_string());
    assert_eq!(broker.subscriber_count(), 2);

    // 取消 sub2
    assert!(broker.unsubscribe("temp"));
    assert_eq!(broker.subscriber_count(), 1);

    drop(sub1);
    drop(sub2);
    drop(tx);
}
