use std::fs;
use std::path::Path;

pub fn cleanup_old_versions(exe_path: &str) {
    let dir = match Path::new(exe_path).parent() {
        Some(d) => d,
        None => return,
    };
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".old") || name.ends_with(".new") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}
