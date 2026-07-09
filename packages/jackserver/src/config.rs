use serde::Deserialize;
use std::path::{Path, PathBuf};

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
    /// 单 IP 每分钟上报上限
    #[serde(default = "default_rate_limit_per_minute")]
    pub rate_limit_per_minute: u32,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            track_secret: String::new(),
            allowed_origins: Vec::new(),
            rate_limit_per_minute: 60,
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_rate_limit_per_minute() -> u32 {
    60
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
