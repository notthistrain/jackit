use std::process::Command;

pub fn launch_tool(file_path: &str) -> Result<u32, String> {
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        return Err(format!("file not found: {}", file_path));
    }
    let work_dir = path.parent().unwrap_or(std::path::Path::new(".")).to_string_lossy().to_string();
    let child = Command::new(file_path)
        .current_dir(work_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(child.id())
}
