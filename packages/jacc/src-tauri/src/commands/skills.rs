use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct GithubInstallResult {
    pub temp_dir: String,
    pub skills: Vec<SkillInfo>,
}

#[tauri::command]
pub async fn list_skills(project_path: String) -> AppResult<Vec<SkillInfo>> {
    let mut skills = vec![];

    // 项目级 skills
    let project_skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
    if project_skills_dir.exists() {
        collect_skills(&project_skills_dir, "project", true, &mut skills)?;
    }

    // 项目级 disabled skills
    let disabled_dir = project_skills_dir.join(".disabled");
    if disabled_dir.exists() {
        collect_skills(&disabled_dir, "project", false, &mut skills)?;
    }

    // 用户级 skills
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let user_skills_dir = home.join(".claude").join("skills");
    if user_skills_dir.exists() {
        collect_skills(&user_skills_dir, "user", true, &mut skills)?;
    }

    Ok(skills)
}

#[tauri::command]
pub async fn toggle_skill(project_path: String, name: String, enabled: bool) -> AppResult<()> {
    let skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
    let disabled_dir = skills_dir.join(".disabled");

    if enabled {
        // 从 .disabled/ 移到 skills/
        let src = disabled_dir.join(&name);
        let dst = skills_dir.join(&name);
        if src.exists() {
            std::fs::rename(&src, &dst)?;
        }
    } else {
        // 从 skills/ 移到 .disabled/
        let src = skills_dir.join(&name);
        let dst = disabled_dir.join(&name);
        std::fs::create_dir_all(&disabled_dir)?;
        if src.exists() {
            std::fs::rename(&src, &dst)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_skill(project_path: String, source_path: String) -> AppResult<()> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(AppError::Custom("源路径不存在".to_string()));
    }

    let name = source
        .file_name()
        .ok_or_else(|| AppError::Custom("无效的源路径".to_string()))?
        .to_string_lossy()
        .to_string();

    let dst = PathBuf::from(&project_path)
        .join(".claude")
        .join("skills")
        .join(&name);

    copy_dir_recursive(&source, &dst)?;
    Ok(())
}

#[tauri::command]
pub async fn install_skill_from_github(
    _project_path: String,
    repo_url: String,
) -> AppResult<GithubInstallResult> {
    // Clone 到临时目录
    let temp_dir = std::env::temp_dir().join(format!(
        "jacc-skill-{}",
        chrono::Utc::now().timestamp()
    ));
    std::fs::create_dir_all(&temp_dir)?;

    let output = std::process::Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            &repo_url,
            &temp_dir.to_string_lossy(),
        ])
        .output()
        .map_err(|e| AppError::Custom(format!("git clone 失败: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Custom(format!("git clone 失败: {}", stderr)));
    }

    // 扫描 skill 目录（查找包含 SKILL.md 的目录）
    let mut available_skills = vec![];
    scan_for_skills(&temp_dir, &mut available_skills)?;

    Ok(GithubInstallResult {
        temp_dir: temp_dir.to_string_lossy().to_string(),
        skills: available_skills,
    })
}

#[tauri::command]
pub async fn confirm_install_skill(
    project_path: String,
    temp_dir: String,
    skill_names: Vec<String>,
) -> AppResult<()> {
    let temp_path = PathBuf::from(&temp_dir);
    let dst_base = PathBuf::from(&project_path).join(".claude").join("skills");
    std::fs::create_dir_all(&dst_base)?;

    for name in &skill_names {
        let src = find_skill_dir(&temp_path, name)?;
        let dst = dst_base.join(name);
        copy_dir_recursive(&src, &dst)?;
    }

    // 清理临时目录
    std::fs::remove_dir_all(&temp_path).ok();
    Ok(())
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
    // 取第一行非空非标题行作为描述
    content
        .lines()
        .find(|line| !line.is_empty() && !line.starts_with('#'))
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
