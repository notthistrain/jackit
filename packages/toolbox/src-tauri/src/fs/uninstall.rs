use std::fs;

pub fn remove_install_dir(path: &str) -> Result<(), String> {
    let p = std::path::Path::new(path);
    if p.exists() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}
