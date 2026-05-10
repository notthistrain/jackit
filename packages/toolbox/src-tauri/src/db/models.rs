use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: i64,
    pub name: String,
    pub identifier: String,
    pub display_name: String,
    pub version: String,
    pub icon: String,
    pub description: String,
    pub ext: String,
    pub file_path: String,
    pub installed_at: String,
    pub remote_updated_at: String,
    pub local_updated_at: String,
    #[serde(default)]
    pub versions: Vec<ToolVersion>,
}

impl Default for Tool {
    fn default() -> Self {
        Tool {
            id: 0, name: String::new(), identifier: String::new(),
            display_name: String::new(), version: String::new(),
            icon: String::new(), description: String::new(),
            ext: String::new(), file_path: String::new(),
            installed_at: String::new(), remote_updated_at: String::new(),
            local_updated_at: String::new(), versions: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolVersion {
    pub id: i64,
    pub tool_id: i64,
    pub version_id: i64,
    pub sequence: String,
    pub size: i64,
    pub force: bool,
    pub changelog: String,
    pub downloaded: bool,
    pub deleted: bool,
    pub created_at: String,
}

pub fn query_tools(conn: &rusqlite::Connection, filter: &str) -> Result<Vec<Tool>, String> {
    let sql = match filter {
        "installed" => "SELECT id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at FROM tools WHERE installed_at IS NOT NULL AND installed_at != ''",
        "not_installed" => "SELECT id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at FROM tools WHERE installed_at IS NULL OR installed_at = ''",
        _ => "SELECT id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at FROM tools",
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Tool {
            id: row.get(0)?,
            name: row.get(1)?,
            identifier: row.get(2).unwrap_or_default(),
            display_name: row.get(3).unwrap_or_default(),
            version: row.get(4).unwrap_or_default(),
            icon: row.get(5).unwrap_or_default(),
            description: row.get(6).unwrap_or_default(),
            ext: row.get(7).unwrap_or_default(),
            file_path: row.get(8).unwrap_or_default(),
            installed_at: row.get(9).unwrap_or_default(),
            remote_updated_at: row.get(10).unwrap_or_default(),
            local_updated_at: row.get(11).unwrap_or_default(),
            versions: vec![],
        })
    }).map_err(|e| e.to_string())?;

    let mut tools: Vec<Tool> = rows.filter_map(|r| r.ok()).collect();
    for tool in &mut tools {
        tool.versions = query_versions_by_tool(conn, tool.id).unwrap_or_default();
    }
    Ok(tools)
}

pub fn query_tool_by_id(conn: &rusqlite::Connection, id: i64) -> Result<Tool, String> {
    let mut stmt = conn.prepare("SELECT id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at FROM tools WHERE id = ?1").map_err(|e| e.to_string())?;
    let mut tool: Tool = stmt.query_row(params![id], |row| {
        Ok(Tool {
            id: row.get(0)?,
            name: row.get(1)?,
            identifier: row.get(2).unwrap_or_default(),
            display_name: row.get(3).unwrap_or_default(),
            version: row.get(4).unwrap_or_default(),
            icon: row.get(5).unwrap_or_default(),
            description: row.get(6).unwrap_or_default(),
            ext: row.get(7).unwrap_or_default(),
            file_path: row.get(8).unwrap_or_default(),
            installed_at: row.get(9).unwrap_or_default(),
            remote_updated_at: row.get(10).unwrap_or_default(),
            local_updated_at: row.get(11).unwrap_or_default(),
            versions: vec![],
        })
    }).map_err(|e| e.to_string())?;
    tool.versions = query_versions_by_tool(conn, tool.id).unwrap_or_default();
    Ok(tool)
}

pub fn upsert_tool(conn: &rusqlite::Connection, t: &Tool) -> Result<(), String> {
    conn.execute(
        "INSERT INTO tools (id, name, identifier, display_name, version, icon, description, ext, file_path, installed_at, remote_updated_at, local_updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET name=?2, identifier=?3, display_name=?4, version=?5, icon=?6, description=?7, ext=?8, file_path=?9, installed_at=?10, remote_updated_at=?11, local_updated_at=?12",
        params![t.id, t.name, t.identifier, t.display_name, t.version, t.icon, t.description, t.ext, t.file_path, t.installed_at, t.remote_updated_at, t.local_updated_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn query_versions_by_tool(conn: &rusqlite::Connection, tool_id: i64) -> Result<Vec<ToolVersion>, String> {
    let mut stmt = conn.prepare("SELECT id, tool_id, version_id, sequence, size, force, changelog, downloaded, deleted, created_at FROM tool_versions WHERE tool_id = ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![tool_id], |row| {
        Ok(ToolVersion {
            id: row.get(0)?,
            tool_id: row.get(1)?,
            version_id: row.get(2)?,
            sequence: row.get(3)?,
            size: row.get(4)?,
            force: row.get::<_, i32>(5)? != 0,
            changelog: row.get(6).unwrap_or_default(),
            downloaded: row.get::<_, i32>(7)? != 0,
            deleted: row.get::<_, i32>(8)? != 0,
            created_at: row.get(9).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[allow(dead_code)]
pub fn upsert_version(conn: &rusqlite::Connection, v: &ToolVersion) -> Result<(), String> {
    conn.execute(
        "INSERT INTO tool_versions (tool_id, version_id, sequence, size, force, changelog, downloaded, deleted, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(tool_id, version_id) DO UPDATE SET sequence=?3, size=?4, force=?5, changelog=?6, downloaded=?7, deleted=?8, created_at=?9",
        params![v.tool_id, v.version_id, v.sequence, v.size, v.force as i32, v.changelog, v.downloaded as i32, v.deleted as i32, v.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
