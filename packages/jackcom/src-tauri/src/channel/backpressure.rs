use serde::{Deserialize, Serialize};

/// 背压策略：当前端通道满时如何处理
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "strategy", content = "config")]
pub enum BackpressureStrategy {
    /// 丢弃最新帧（默认）
    DropNewest,
    /// 降采样：每 N 帧只推 1 帧
    Downsample { every_n: u32 },
    /// 只保留最新帧（丢弃旧帧）
    BufferLatest,
}

impl Default for BackpressureStrategy {
    fn default() -> Self {
        Self::DropNewest
    }
}

/// 降采样过滤器
/// 维护一个计数器，每 `every_n` 帧放行一次
#[derive(Debug)]
pub struct Downsampler {
    every_n: u32,
    counter: u32,
}

impl Downsampler {
    pub fn new(every_n: u32) -> Self {
        assert!(every_n > 0, "every_n must be > 0");
        Self {
            every_n,
            counter: 0,
        }
    }

    /// 尝试放行：返回 true 表示应该发送，false 表示丢弃
    pub fn should_send(&mut self) -> bool {
        self.counter += 1;
        if self.counter >= self.every_n {
            self.counter = 0;
            true
        } else {
            false
        }
    }

    /// 重置计数器
    pub fn reset(&mut self) {
        self.counter = 0;
    }

    pub fn every_n(&self) -> u32 {
        self.every_n
    }

    pub fn counter(&self) -> u32 {
        self.counter
    }
}

/// 背压决策：给定策略和通道状态，决定是否发送
pub fn should_send_event(
    strategy: &BackpressureStrategy,
    channel_is_full: bool,
    sampler: &mut Option<Downsampler>,
) -> bool {
    if !channel_is_full {
        // 通道未满，总是发送
        return true;
    }

    match strategy {
        BackpressureStrategy::DropNewest => {
            // 通道满时丢弃
            false
        }
        BackpressureStrategy::Downsample { every_n } => {
            // 使用降采样器
            let sampler = sampler.get_or_insert_with(|| Downsampler::new(*every_n));
            sampler.should_send()
        }
        BackpressureStrategy::BufferLatest => {
            // 通道满时仍然尝试（调用方应先 drain 旧消息）
            true
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_strategy_is_drop_newest() {
        assert_eq!(BackpressureStrategy::default(), BackpressureStrategy::DropNewest);
    }

    #[test]
    fn strategy_serializes_to_json() {
        let s = BackpressureStrategy::Downsample { every_n: 10 };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("Downsample"));
        assert!(json.contains("10"));
    }

    #[test]
    fn strategy_deserializes_from_json() {
        let json = r#"{"strategy":"Downsample","config":{"every_n":5}}"#;
        let s: BackpressureStrategy = serde_json::from_str(json).unwrap();
        assert_eq!(s, BackpressureStrategy::Downsample { every_n: 5 });
    }

    #[test]
    fn drop_newest_strategy_serializes() {
        let json = serde_json::to_string(&BackpressureStrategy::DropNewest).unwrap();
        assert!(json.contains("DropNewest"));
    }

    // --- Downsampler 测试 ---

    #[test]
    fn downsampler_passes_every_n_frame() {
        let mut sampler = Downsampler::new(3);
        assert!(!sampler.should_send()); // 1
        assert!(!sampler.should_send()); // 2
        assert!(sampler.should_send());  // 3 -> 通过
        assert!(!sampler.should_send()); // 1
        assert!(!sampler.should_send()); // 2
        assert!(sampler.should_send());  // 3 -> 通过
    }

    #[test]
    fn downsampler_every_1_passes_all() {
        let mut sampler = Downsampler::new(1);
        assert!(sampler.should_send());
        assert!(sampler.should_send());
        assert!(sampler.should_send());
    }

    #[test]
    fn downsampler_reset_clears_counter() {
        let mut sampler = Downsampler::new(10);
        sampler.should_send(); // counter = 1
        sampler.should_send(); // counter = 2
        assert_eq!(sampler.counter(), 2);
        sampler.reset();
        assert_eq!(sampler.counter(), 0);
    }

    #[test]
    #[should_panic(expected = "every_n must be > 0")]
    fn downsampler_rejects_zero() {
        Downsampler::new(0);
    }

    #[test]
    fn downsampler_accessors() {
        let sampler = Downsampler::new(7);
        assert_eq!(sampler.every_n(), 7);
        assert_eq!(sampler.counter(), 0);
    }

    // --- should_send_event 测试 ---

    #[test]
    fn send_event_always_true_when_channel_not_full() {
        let mut sampler = None;
        assert!(should_send_event(&BackpressureStrategy::DropNewest, false, &mut sampler));
        assert!(should_send_event(&BackpressureStrategy::Downsample { every_n: 5 }, false, &mut sampler));
        assert!(should_send_event(&BackpressureStrategy::BufferLatest, false, &mut sampler));
    }

    #[test]
    fn send_event_drop_newest_false_when_full() {
        let mut sampler = None;
        assert!(!should_send_event(&BackpressureStrategy::DropNewest, true, &mut sampler));
    }

    #[test]
    fn send_event_downsample_when_full() {
        let mut sampler = None;
        // every_n = 2: 第一次 false，第二次 true
        assert!(!should_send_event(&BackpressureStrategy::Downsample { every_n: 2 }, true, &mut sampler));
        assert!(should_send_event(&BackpressureStrategy::Downsample { every_n: 2 }, true, &mut sampler));
    }

    #[test]
    fn send_event_buffer_latest_always_true() {
        let mut sampler = None;
        assert!(should_send_event(&BackpressureStrategy::BufferLatest, true, &mut sampler));
        assert!(should_send_event(&BackpressureStrategy::BufferLatest, true, &mut sampler));
    }
}
