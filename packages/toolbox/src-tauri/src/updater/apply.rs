use std::fs;
use std::process::Command;
use std::path::Path;

pub fn generate_update_script(exe_path: &str, pid: u32) -> String {
    let old_path = format!("{}.old", exe_path);
    let new_path = format!("{}.new", exe_path);
    let exe_name = Path::new(exe_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();

    format!(r#"@echo off
chcp 65001 >nul
echo Toolbox Updater
echo Waiting for process {pid} to exit...

:wait_loop
tasklist /FI "PID eq {pid}" 2>nul | find "{pid}" >nul
if %errorlevel% equ 0 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo Process exited, applying update...

if exist "{old_path}" del /f /q "{old_path}"

if exist "{exe_path}" (
    ren "{exe_path}" "{exe_name}.old"
)

if exist "{new_path}" (
    move /y "{new_path}" "{exe_path}"
)

echo Update completed, starting application...
start "" "{exe_path}"
"#)
}

pub fn apply_update(exe_path: &str) -> Result<(), String> {
    let new_path = format!("{}.new", exe_path);
    if !Path::new(&new_path).exists() {
        return Err("new version file not found".into());
    }
    Ok(())
}

pub fn restart_for_update(exe_path: &str) -> Result<(), String> {
    apply_update(exe_path)?;

    let pid = std::process::id();
    let script = generate_update_script(exe_path, pid);
    let script_path = std::env::temp_dir().join("toolbox_update.bat");
    fs::write(&script_path, &script).map_err(|e| e.to_string())?;

    Command::new("cmd.exe")
        .arg("/c")
        .arg(&script_path)
        .spawn()
        .map_err(|e| e.to_string())?;

    std::process::exit(0);
}
