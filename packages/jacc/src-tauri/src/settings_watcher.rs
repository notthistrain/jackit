use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct SettingsChangedEvent {
    pub scope: String, // "global" | "project"
    pub path: String,
}

pub struct SettingsWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    project: Arc<Mutex<Option<PathBuf>>>,
}

impl SettingsWatcher {
    pub fn start(app: AppHandle, global_path: PathBuf) -> notify::Result<Self> {
        let project: Arc<Mutex<Option<PathBuf>>> = Arc::new(Mutex::new(None));
        let project_clone = project.clone();
        let global_clone = global_path.clone();
        let app_clone = app.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            move |res: DebounceEventResult| {
                let events = match res {
                    Ok(e) => e,
                    Err(err) => {
                        tracing::warn!(?err, "watcher debounce error");
                        return;
                    }
                };
                for ev in events {
                    let p = ev.path.clone();
                    let scope = if p == global_clone {
                        Some("global")
                    } else if let Ok(guard) = project_clone.lock() {
                        match &*guard {
                            Some(pp) if &p == pp => Some("project"),
                            _ => None,
                        }
                    } else {
                        None
                    };
                    if let Some(scope) = scope {
                        let payload = SettingsChangedEvent {
                            scope: scope.to_string(),
                            path: p.to_string_lossy().to_string(),
                        };
                        if let Err(err) = app_clone.emit("settings-changed", &payload) {
                            tracing::warn!(?err, "failed to emit settings-changed");
                        } else {
                            tracing::info!(scope, path = %payload.path, "settings-changed emitted");
                        }
                    }
                }
            },
        )?;

        // 监听全局：注意 watch 的是父目录非文件本身（notify 限制）
        if let Some(parent) = global_path.parent() {
            std::fs::create_dir_all(parent).ok();
            debouncer
                .watcher()
                .watch(parent, RecursiveMode::NonRecursive)?;
        }

        Ok(Self { debouncer, project })
    }

    pub fn set_active_project(&mut self, path: Option<PathBuf>) -> notify::Result<()> {
        let mut guard = self.project.lock().map_err(|_| {
            notify::Error::generic("settings watcher project lock poisoned")
        })?;
        // 卸载旧 project watch
        if let Some(old) = guard.take() {
            if let Some(parent) = old.parent() {
                let _ = self.debouncer.watcher().unwatch(parent);
            }
        }
        // 装载新 project watch
        if let Some(new_path) = path {
            if let Some(parent) = new_path.parent() {
                std::fs::create_dir_all(parent).ok();
                self.debouncer
                    .watcher()
                    .watch(parent, RecursiveMode::NonRecursive)?;
            }
            *guard = Some(new_path);
        }
        Ok(())
    }
}
