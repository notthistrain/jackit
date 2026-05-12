pub mod config;
pub mod manager;
pub mod port;
pub mod watcher;

pub use config::SerialConfig;
pub use manager::SerialManager;
pub use port::LowLatencyPort;
pub use watcher::PortWatcher;
