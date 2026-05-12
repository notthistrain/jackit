pub mod config;
pub mod port;
pub mod watcher;

pub use config::SerialConfig;
pub use port::LowLatencyPort;
pub use watcher::PortWatcher;
