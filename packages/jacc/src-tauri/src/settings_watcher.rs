use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use std::path::{Path, PathBuf};
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

/// 判定一次文件改动属于哪个 scope，供 watcher 回调使用。
/// global：命中全局 settings.json；project：命中项目 settings.json **或**
/// settings.local.json（凭证等敏感项写入 local，同为项目级）；其它 None。
fn classify_settings_change(
    p: &Path,
    global: &Path,
    project: Option<&Path>,
) -> Option<&'static str> {
    if p == global {
        return Some("global");
    }
    let project = project?;
    if p == project {
        return Some("project");
    }
    let local = project.with_file_name("settings.local.json");
    if p == local.as_path() {
        return Some("project");
    }
    None
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
                    let project_opt = project_clone.lock().ok().and_then(|g| g.clone());
                    let scope = classify_settings_change(&p, &global_clone, project_opt.as_deref());
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

#[cfg(test)]
mod tests {
    use super::classify_settings_change;
    use std::path::Path;

    #[test]
    fn classifies_global_settings_json() {
        let g = Path::new("/home/.claude/settings.json");
        assert_eq!(classify_settings_change(g, g, None), Some("global"));
    }

    #[test]
    fn classifies_project_shared_settings_json() {
        let g = Path::new("/home/.claude/settings.json");
        let p = Path::new("/proj/.claude/settings.json");
        assert_eq!(classify_settings_change(p, g, Some(p)), Some("project"));
    }

    #[test]
    fn classifies_project_local_settings_json() {
        let g = Path::new("/home/.claude/settings.json");
        let p = Path::new("/proj/.claude/settings.json");
        let local = Path::new("/proj/.claude/settings.local.json");
        assert_eq!(classify_settings_change(local, g, Some(p)), Some("project"));
    }

    #[test]
    fn ignores_unrelated_file_in_project_dir() {
        let g = Path::new("/home/.claude/settings.json");
        let p = Path::new("/proj/.claude/settings.json");
        let other = Path::new("/proj/.claude/other.json");
        assert_eq!(classify_settings_change(other, g, Some(p)), None);
    }

    #[test]
    fn ignores_local_when_no_active_project() {
        let g = Path::new("/home/.claude/settings.json");
        let local = Path::new("/proj/.claude/settings.local.json");
        assert_eq!(classify_settings_change(local, g, None), None);
    }
}
