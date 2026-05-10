pub mod settings;
pub use settings::{Config, get_resolved_db_path, load, save};

// Re-export types for potential future use
#[allow(unused_imports)]
pub use settings::{AppConfig, DatabaseConfig, LogConfig, ServerConfig, ToolConfig};
