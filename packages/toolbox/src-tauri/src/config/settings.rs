use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub app: AppConfig,
    pub tool: ToolConfig,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub log: LogConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_app_name")]
    pub name: String,
    #[serde(default = "default_environment")]
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    #[serde(default = "default_install_path")]
    pub install_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_server_address")]
    pub address: String,
    #[serde(default = "default_s3_port")]
    pub s3_port: i32,
    #[serde(default = "default_manual_path")]
    pub manual_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    #[serde(default = "default_db_type")]
    pub db_type: String,
    #[serde(default = "default_db_path")]
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    #[serde(default = "default_log_level")]
    pub level: String,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub output_path: String,
    #[serde(default = "default_ten")]
    pub max_size: i32,
    #[serde(default = "default_five")]
    pub max_backups: i32,
    #[serde(default = "default_thirty")]
    pub max_age: i32,
    #[serde(default = "default_true")]
    pub compress: bool,
}

fn default_app_name() -> String {
    "toolbox".into()
}

fn default_environment() -> String {
    "production".into()
}

fn default_install_path() -> String {
    "tools".into()
}

fn default_server_address() -> String {
    "http://127.0.0.1:7001".into()
}

fn default_s3_port() -> i32 {
    9090
}

fn default_manual_path() -> String {
    "/manual".into()
}

fn default_db_type() -> String {
    "sqlite".into()
}

fn default_db_path() -> String {
    "data/toolbox.db".into()
}

fn default_log_level() -> String {
    "debug".into()
}

fn default_ten() -> i32 {
    10
}

fn default_five() -> i32 {
    5
}

fn default_thirty() -> i32 {
    30
}

fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Config {
            app: AppConfig {
                name: default_app_name(),
                environment: default_environment(),
            },
            tool: ToolConfig {
                install_path: default_install_path(),
            },
            server: ServerConfig {
                address: default_server_address(),
                s3_port: default_s3_port(),
                manual_path: default_manual_path(),
            },
            database: DatabaseConfig {
                db_type: default_db_type(),
                path: default_db_path(),
            },
            log: LogConfig {
                level: default_log_level(),
                format: String::new(),
                output_path: String::new(),
                max_size: default_ten(),
                max_backups: default_five(),
                max_age: default_thirty(),
                compress: default_true(),
            },
        }
    }
}

pub fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = home.join(".jackit").join("toolbox");

    // 迁移旧数据
    let old_dir = home.join(".tbox");
    if old_dir.exists() && !new_dir.exists() {
        std::fs::create_dir_all(new_dir.parent().unwrap_or(&home)).ok();
        // 尝试移动整个目录
        if std::fs::rename(&old_dir, &new_dir).is_err() {
            // 如果跨盘符无法 rename，逐文件拷贝
            copy_dir_recursive(&old_dir, &new_dir).ok();
        }
    }

    std::fs::create_dir_all(&new_dir).ok();
    new_dir
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

pub fn config_path() -> PathBuf {
    config_dir().join("toolbox.yaml")
}

pub fn load() -> Result<Config, String> {
    let path = config_path();
    if !path.exists() {
        fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        let default = Config::default();
        save(&default)?;
        return Ok(default);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let cfg: Config = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    Ok(cfg)
}

pub fn save(cfg: &Config) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let yaml = serde_yaml::to_string(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, yaml).map_err(|e| e.to_string())
}

pub fn resolve_path(path: &str, base_dir: &std::path::Path) -> PathBuf {
    let p = PathBuf::from(path);
    if p.is_absolute() {
        p
    } else {
        base_dir.join(path)
    }
}

pub fn get_resolved_db_path(cfg: &Config) -> PathBuf {
    resolve_path(&cfg.database.path, &config_dir())
}
