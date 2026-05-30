use std::path::PathBuf;
use crate::error::{AppError, AppResult};

#[cfg(target_os = "windows")]
const SYSTEM_PREFIXES: &[&str] = &[
    "C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData",
];

#[cfg(not(target_os = "windows"))]
const SYSTEM_PREFIXES: &[&str] = &[
    "/etc", "/usr", "/bin", "/sbin", "/System", "/private", "/var",
];

/// 校验项目路径：必须存在、是目录、canonicalize 后不在系统敏感前缀
pub fn validate_project_path(s: &str) -> AppResult<PathBuf> {
    if s.is_empty() {
        return Err(AppError::Custom("INVALID_PROJECT_PATH:empty".into()));
    }
    let p = PathBuf::from(s);
    if !p.exists() || !p.is_dir() {
        return Err(AppError::Custom(format!("INVALID_PROJECT_PATH:not_a_directory:{}", s)));
    }
    let canonical = p.canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_PROJECT_PATH:canonicalize_failed:{}", e)))?;
    let canon_str = canonical.to_string_lossy().to_string();
    for prefix in SYSTEM_PREFIXES {
        if canon_str.starts_with(prefix) {
            return Err(AppError::Custom(format!("INVALID_PROJECT_PATH:system_path:{}", canon_str)));
        }
    }
    Ok(canonical)
}

/// 校验 skill 名：仅允许 ^[a-zA-Z0-9_-]{1,64}$
pub fn validate_skill_name(s: &str) -> AppResult<String> {
    if s.is_empty() || s.len() > 64 {
        return Err(AppError::Custom("INVALID_SKILL_NAME:length".into()));
    }
    if !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err(AppError::Custom(format!("INVALID_SKILL_NAME:bad_chars:{}", s)));
    }
    Ok(s.to_string())
}

/// 校验临时目录：必须 starts_with std::env::temp_dir() canonicalize 后的前缀
pub fn validate_temp_dir(s: &str) -> AppResult<PathBuf> {
    let p = PathBuf::from(s);
    if !p.exists() {
        return Err(AppError::Custom(format!("INVALID_TEMP_DIR:not_exist:{}", s)));
    }
    let canonical = p.canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_TEMP_DIR:canonicalize_failed:{}", e)))?;
    let temp_root = std::env::temp_dir().canonicalize()
        .map_err(|e| AppError::Custom(format!("INVALID_TEMP_DIR:temp_root:{}", e)))?;
    if !canonical.starts_with(&temp_root) {
        return Err(AppError::Custom(format!(
            "INVALID_TEMP_DIR:outside_temp:{}", canonical.to_string_lossy()
        )));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_path_rejects_empty() {
        assert!(validate_project_path("").is_err());
    }

    #[test]
    fn project_path_rejects_nonexistent() {
        assert!(validate_project_path("/nonexistent/zzz/yyy").is_err());
    }

    #[test]
    fn project_path_accepts_tempdir() {
        let dir = tempfile::tempdir().unwrap();
        let s = dir.path().to_string_lossy().to_string();
        assert!(validate_project_path(&s).is_ok());
    }

    #[test]
    fn skill_name_accepts_normal() {
        assert!(validate_skill_name("brainstorming").is_ok());
        assert!(validate_skill_name("my_skill-2").is_ok());
    }

    #[test]
    fn skill_name_rejects_path_traversal() {
        assert!(validate_skill_name("../etc").is_err());
        assert!(validate_skill_name("foo/bar").is_err());
        assert!(validate_skill_name("foo\\bar").is_err());
        assert!(validate_skill_name("").is_err());
    }

    #[test]
    fn temp_dir_accepts_subdir_of_temp() {
        let dir = tempfile::tempdir().unwrap();
        let s = dir.path().to_string_lossy().to_string();
        assert!(validate_temp_dir(&s).is_ok());
    }

    #[test]
    fn temp_dir_rejects_outside_temp() {
        let home = dirs::home_dir().unwrap();
        let s = home.to_string_lossy().to_string();
        assert!(validate_temp_dir(&s).is_err());
    }
}
