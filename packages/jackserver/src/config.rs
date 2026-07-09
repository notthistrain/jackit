use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub publish: PublishConfig,
    #[serde(default)]
    pub metrics: MetricsConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PublishConfig {
    pub token: String,
}

/// 访问量统计（打点）配置
#[derive(Debug, Clone, Deserialize)]
pub struct MetricsConfig {
    /// 总开关；false 时打点端点直接放行不入库（便于临时禁用）
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 上报签名密钥（前端 SDK 嵌入）。注意：前端可见，仅提高门槛，不保证防伪。
    #[serde(default)]
    pub track_secret: String,
    /// 允许上报的来源域名白名单（校验浏览器 Origin / Referer）
    #[serde(default)]
    pub allowed_origins: Vec<String>,
    /// 单 IP 上报限流，格式 "N/unit"：N 为每个窗口的最大次数，unit 为时间单位
    /// s/m/h（可带倍数，如 2s 表示 2 秒）。示例：
    /// - `"10/s"`  每秒 10 次
    /// - `"1/2s"`  每 2 秒 1 次
    /// - `"60/m"`  每分钟 60 次（默认）
    /// - `"100/h"` 每小时 100 次
    /// 解析失败会在启动时 fail fast（见 handler::app）。
    #[serde(default = "default_rate_limit")]
    pub rate_limit: String,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            track_secret: String::new(),
            allowed_origins: Vec::new(),
            rate_limit: default_rate_limit(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_rate_limit() -> String {
    "60/m".to_string()
}

impl MetricsConfig {
    /// 解析 rate_limit 字符串为 (每窗口最大次数, 窗口时长)。
    pub fn parse_rate_limit(&self) -> Result<(u32, Duration), String> {
        parse_rate_limit_spec(&self.rate_limit)
    }
}

/// 解析 "N/unit" → (N, Duration)。N 为正整数；unit 为 s/m/h，可带倍数（如 2s = 2 秒）。
fn parse_rate_limit_spec(s: &str) -> Result<(u32, Duration), String> {
    let s = s.trim();
    let (max_str, unit_str) = s
        .split_once('/')
        .ok_or_else(|| format!("rate_limit 格式应为 N/unit（如 10/s、60/m），实际: {s:?}"))?;
    let max: u32 = max_str
        .trim()
        .parse()
        .map_err(|_| format!("rate_limit 次数必须是正整数，实际: {max_str:?}"))?;
    if max == 0 {
        return Err(
            "rate_limit 次数必须大于 0；要禁用打点请用 metrics.enabled = false".to_string(),
        );
    }
    let window = parse_unit(unit_str)?;
    Ok((max, window))
}

/// 解析单位串为时长：`"s"`→1s、`"2s"`→2s、`"m"`→60s、`"10m"`→600s、`"h"`→3600s。
fn parse_unit(s: &str) -> Result<Duration, String> {
    let s = s.trim();
    if s.is_empty() {
        return Err("rate_limit 缺少时间单位（s/m/h）".to_string());
    }
    // 按字符边界拆出末尾的单位字符，避免多字节 UTF-8 panic。
    let last_idx = s.char_indices().last().map(|(i, _)| i).unwrap();
    let (num_part, unit_part) = s.split_at(last_idx);
    let mult: u64 = if num_part.is_empty() {
        1
    } else {
        let n: u64 = num_part
            .trim()
            .parse()
            .map_err(|_| format!("rate_limit 单位倍数必须是正整数，实际: {num_part:?}"))?;
        if n == 0 {
            return Err("rate_limit 单位倍数必须大于 0".to_string());
        }
        n
    };
    let base_secs: u64 = match unit_part {
        "s" => 1,
        "m" => 60,
        "h" => 3600,
        other => return Err(format!("rate_limit 不支持的单位 {other:?}，仅支持 s/m/h")),
    };
    mult.checked_mul(base_secs)
        .map(Duration::from_secs)
        .ok_or_else(|| "rate_limit 窗口时长溢出".to_string())
}

impl AppConfig {
    pub fn load(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let config: AppConfig = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn load_or_default() -> Self {
        let default_path = std::env::current_exe()
            .ok()
            .map(|p| p.parent().map(|d| d.join("config.toml")).unwrap())
            .unwrap_or_else(|| PathBuf::from("config.toml"));

        let config_path = std::env::args()
            .collect::<Vec<_>>()
            .iter()
            .position(|a| a == "--config")
            .and_then(|i| std::env::args().nth(i + 1))
            .map(PathBuf::from)
            .unwrap_or(default_path);

        Self::load(&config_path).unwrap_or_else(|e| {
            eprintln!(
                "Failed to load config from {}: {}. Using defaults.",
                config_path.display(),
                e
            );
            std::process::exit(1);
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_formats() {
        assert_eq!(parse_rate_limit_spec("10/s").unwrap(), (10, Duration::from_secs(1)));
        assert_eq!(parse_rate_limit_spec("60/m").unwrap(), (60, Duration::from_secs(60)));
        assert_eq!(parse_rate_limit_spec("1/2s").unwrap(), (1, Duration::from_secs(2)));
        assert_eq!(parse_rate_limit_spec("100/h").unwrap(), (100, Duration::from_secs(3600)));
        assert_eq!(parse_rate_limit_spec("5/10m").unwrap(), (5, Duration::from_secs(600)));
    }

    #[test]
    fn parse_tolerates_whitespace() {
        assert_eq!(
            parse_rate_limit_spec("  10 / s ").unwrap(),
            (10, Duration::from_secs(1))
        );
    }

    #[test]
    fn parse_rejects_zero_max() {
        assert!(parse_rate_limit_spec("0/s").is_err());
    }

    #[test]
    fn parse_rejects_zero_multiplier() {
        assert!(parse_rate_limit_spec("10/0s").is_err());
    }

    #[test]
    fn parse_rejects_invalid_input() {
        assert!(parse_rate_limit_spec("10").is_err()); // 缺 /
        assert!(parse_rate_limit_spec("abc/s").is_err()); // 次数非数字
        assert!(parse_rate_limit_spec("10/x").is_err()); // 不支持的单位
        assert!(parse_rate_limit_spec("10/").is_err()); // 缺单位
        assert!(parse_rate_limit_spec("").is_err());
    }

    #[test]
    fn parse_rejects_multibyte_unit() {
        // 非法多字节字符不应 panic，应返回错误
        assert!(parse_rate_limit_spec("10/秒").is_err());
    }

    #[test]
    fn default_config_parses() {
        let m = MetricsConfig::default();
        assert_eq!(m.rate_limit, "60/m");
        assert_eq!(m.parse_rate_limit().unwrap(), (60, Duration::from_secs(60)));
    }
}
