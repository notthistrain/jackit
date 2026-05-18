use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub publish: PublishConfig,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct PublishConfig {
    pub token: String,
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
            eprintln!("Failed to load config from {}: {}. Using defaults.", config_path.display(), e);
            std::process::exit(1);
        })
    }
}
