use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;

#[test]
fn watcher_emits_event_on_external_modify() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("settings.json");
    std::fs::write(&target, b"{}").unwrap();

    let received: Arc<Mutex<Vec<PathBuf>>> = Arc::new(Mutex::new(Vec::new()));
    let received_clone = received.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        move |res: notify_debouncer_mini::DebounceEventResult| {
            if let Ok(events) = res {
                for e in events {
                    received_clone.lock().unwrap().push(e.path);
                }
            }
        },
    )
    .unwrap();
    debouncer
        .watcher()
        .watch(dir.path(), RecursiveMode::NonRecursive)
        .unwrap();

    // 触发修改
    std::fs::write(&target, br#"{"model":"opus"}"#).unwrap();

    // Windows CI debounce + IO 延迟可能 ~1.5s，等 5s
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while std::time::Instant::now() < deadline {
        if !received.lock().unwrap().is_empty() {
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let r = received.lock().unwrap();
    assert!(!r.is_empty(), "expected at least one event within 5s");
    assert!(
        r.iter().any(|p| p == &target),
        "expected event for target file"
    );
}
