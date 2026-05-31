use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Instant;
use std::collections::HashMap;

use crate::error::{AppError, AppResult};

static INSTALL_TOKENS: OnceLock<parking_lot::Mutex<HashMap<String, (PathBuf, Instant)>>> = OnceLock::new();

fn tokens_map() -> &'static parking_lot::Mutex<HashMap<String, (PathBuf, Instant)>> {
    INSTALL_TOKENS.get_or_init(|| parking_lot::Mutex::new(HashMap::new()))
}

fn gc_tokens() {
    let now = Instant::now();
    let mut map = tokens_map().lock();
    let stale: Vec<_> = map
        .iter()
        .filter(|(_, (_, t))| now.duration_since(*t) > std::time::Duration::from_secs(30 * 60))
        .map(|(k, _)| k.clone())
        .collect();
    for k in stale {
        if let Some((path, _)) = map.remove(&k) {
            let _ = std::fs::remove_dir_all(&path);
            tracing::info!(path = %path.display(), "stale install token GC'd");
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct GithubInstallResult {
    pub token: String,
    pub skills: Vec<SkillInfo>,
}

#[tauri::command]
pub async fn list_skills(project_path: String) -> AppResult<Vec<SkillInfo>> {
    log_command!("list_skills", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let mut skills = vec![];

        let project_skills_dir = project.join(".claude").join("skills");
        if project_skills_dir.exists() {
            collect_skills(&project_skills_dir, "project", true, &mut skills)?;
        }

        let disabled_dir = project_skills_dir.join(".disabled");
        if disabled_dir.exists() {
            collect_skills(&disabled_dir, "project", false, &mut skills)?;
        }

        let home = dirs::home_dir().expect("HOME not found, jacc cannot start");
        let user_skills_dir = home.join(".claude").join("skills");
        if user_skills_dir.exists() {
            collect_skills(&user_skills_dir, "user", true, &mut skills)?;
        }

        Ok(skills)
    })
}

#[tauri::command]
pub async fn toggle_skill(project_path: String, name: String, enabled: bool) -> AppResult<()> {
    log_command!("toggle_skill", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let name = crate::path_guard::validate_skill_name(&name)?;
        let skills_dir = project.join(".claude").join("skills");
        let disabled_dir = skills_dir.join(".disabled");

        if enabled {
            let src = disabled_dir.join(&name);
            let dst = skills_dir.join(&name);
            if src.exists() {
                std::fs::rename(&src, &dst)?;
            }
        } else {
            let src = skills_dir.join(&name);
            let dst = disabled_dir.join(&name);
            std::fs::create_dir_all(&disabled_dir)?;
            if src.exists() {
                std::fs::rename(&src, &dst)?;
            }
        }
        tracing::info!(name = %name, enabled, "skill toggled");
        Ok(())
    })
}

#[tauri::command]
pub async fn import_skill(project_path: String, source_path: String) -> AppResult<()> {
    log_command!("import_skill", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let source = PathBuf::from(&source_path);
        if !source.exists() {
            return Err(AppError::Custom("源路径不存在".to_string()));
        }

        let name = source
            .file_name()
            .ok_or_else(|| AppError::Custom("无效的源路径".to_string()))?
            .to_string_lossy()
            .to_string();

        let dst = project
            .join(".claude")
            .join("skills")
            .join(&name);

        copy_dir_recursive(&source, &dst)?;
        tracing::info!(name = %name, source = %source_path, "skill imported");
        Ok(())
    })
}

#[tauri::command]
pub async fn install_skill_from_github(
    _project_path: String,
    repo_url: String,
) -> AppResult<GithubInstallResult> {
    log_command!("install_skill_from_github", {
        gc_tokens();
        let temp_dir = std::env::temp_dir().join(format!("jacc-skill-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        // 异步跑 git（避免阻塞 Tauri 主线程）
        let url = repo_url.clone();
        let tmp_path = temp_dir.clone();
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("git")
                .args(["clone", "--depth", "1", &url, &tmp_path.to_string_lossy()])
                .output()
        })
        .await
        .map_err(|e| AppError::Custom(format!("git spawn: {}", e)))?
        .map_err(|e| AppError::Custom(format!("git clone failed: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Custom(format!("git clone 失败: {}", stderr)));
        }

        let mut available_skills = vec![];
        scan_for_skills(&temp_dir, &mut available_skills)?;

        let token = uuid::Uuid::new_v4().to_string();
        tokens_map().lock().insert(token.clone(), (temp_dir.clone(), Instant::now()));

        tracing::info!(url = %repo_url, count = available_skills.len(), token = %token, "skills fetched");
        Ok(GithubInstallResult {
            token,
            skills: available_skills,
        })
    })
}

#[tauri::command]
pub async fn confirm_install_skill(
    project_path: String,
    token: String,
    skill_names: Vec<String>,
) -> AppResult<()> {
    log_command!("confirm_install_skill", {
        let project = crate::path_guard::validate_project_path(&project_path)?;
        let names: Vec<String> = skill_names
            .iter()
            .map(|n| crate::path_guard::validate_skill_name(n))
            .collect::<AppResult<_>>()?;

        gc_tokens();

        let temp_path = {
            let map = tokens_map().lock();
            map.get(&token)
                .map(|(p, _)| p.clone())
                .ok_or_else(|| AppError::Custom("INSTALL_TOKEN_EXPIRED".into()))?
        };

        // 二次校验路径仍在 temp 下
        crate::path_guard::validate_temp_dir(&temp_path.to_string_lossy())?;

        let dst_base = project.join(".claude").join("skills");
        std::fs::create_dir_all(&dst_base)?;

        for name in &names {
            let src = find_skill_dir(&temp_path, name)?;
            let dst = dst_base.join(name);
            copy_dir_recursive(&src, &dst)?;
        }

        let _ = std::fs::remove_dir_all(&temp_path);
        tokens_map().lock().remove(&token);

        tracing::info!(names = ?names, "skills installed");
        Ok(())
    })
}

fn collect_skills(
    dir: &Path,
    source: &str,
    enabled: bool,
    skills: &mut Vec<SkillInfo>,
) -> AppResult<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir()
            && path
                .file_name()
                .map(|n| !n.to_string_lossy().starts_with('.'))
                .unwrap_or(false)
        {
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            let skill_md = path.join("SKILL.md");
            let description = if skill_md.exists() {
                extract_description(&skill_md)
            } else {
                String::new()
            };
            skills.push(SkillInfo {
                name,
                description,
                enabled,
                source: source.to_string(),
            });
        }
    }
    Ok(())
}

fn extract_description(skill_md: &Path) -> String {
    let content = std::fs::read_to_string(skill_md).unwrap_or_default();

    // 尝试从 YAML frontmatter 中提取 description
    if content.starts_with("---") {
        let rest = &content[3..];
        if let Some(end) = rest.find("---") {
            let frontmatter = &rest[..end];
            for line in frontmatter.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("description:") {
                    let val = trimmed.strip_prefix("description:").unwrap().trim();
                    // 去除引号
                    return val.trim_matches('"').trim_matches('\'').to_string();
                }
            }
        }
    }

    // fallback: 取第一行非空非标题非 frontmatter 行
    content
        .lines()
        .skip_while(|line| line.trim() == "---" || line.is_empty())
        .find(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("---"))
        .unwrap_or("")
        .to_string()
}

fn scan_for_skills(dir: &Path, skills: &mut Vec<SkillInfo>) -> AppResult<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            if skill_md.exists() {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                let description = extract_description(&skill_md);
                skills.push(SkillInfo {
                    name,
                    description,
                    enabled: false,
                    source: "github".to_string(),
                });
            } else {
                // 递归查找子目录
                scan_for_skills(&path, skills)?;
            }
        }
    }
    Ok(())
}

fn find_skill_dir(base: &Path, name: &str) -> AppResult<PathBuf> {
    for entry in walkdir(base)? {
        if entry.is_dir()
            && entry
                .file_name()
                .map(|n| n.to_string_lossy() == name)
                .unwrap_or(false)
        {
            let skill_md = entry.join("SKILL.md");
            if skill_md.exists() {
                return Ok(entry);
            }
        }
    }
    Err(AppError::Custom(format!("未找到 skill: {}", name)))
}

fn walkdir(dir: &Path) -> AppResult<Vec<PathBuf>> {
    let mut results = vec![];
    fn walk(dir: &Path, results: &mut Vec<PathBuf>) -> std::io::Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            results.push(path.clone());
            if path.is_dir() {
                walk(&path, results)?;
            }
        }
        Ok(())
    }
    walk(dir, &mut results)?;
    Ok(results)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
