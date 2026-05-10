use std::cmp::Ordering;
use rusqlite::Connection;

use crate::db::models;
use super::UpdateInfo;

const TOOLBOX_TOOL_NAME: &str = "toolbox";

pub fn check_update(conn: &Connection, current_version: &str) -> Result<Option<UpdateInfo>, String> {
    let tools = models::query_tools(conn, "all")?;
    let toolbox = tools.iter().find(|t| t.name == TOOLBOX_TOOL_NAME)
        .ok_or("toolbox tool not found in database")?;

    if toolbox.versions.is_empty() {
        return Err("no versions available for toolbox".into());
    }

    // Find the latest version (highest version number)
    let mut versions = toolbox.versions.clone();
    versions.sort_by(|a, b| compare_versions(&b.sequence, &a.sequence));
    let latest = &versions[0];

    if compare_versions(&latest.sequence, current_version) != Ordering::Greater {
        return Ok(None);
    }

    Ok(Some(UpdateInfo {
        version: latest.sequence.clone(),
        version_id: latest.version_id,
        size: latest.size,
        release_note: "新版本可用".into(),
    }))
}

fn compare_versions(a: &str, b: &str) -> Ordering {
    let parse = |v: &str| -> Vec<i64> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let va = parse(a);
    let vb = parse(b);
    let max_len = va.len().max(vb.len());
    for i in 0..max_len {
        let na = va.get(i).unwrap_or(&0);
        let nb = vb.get(i).unwrap_or(&0);
        if na != nb {
            return na.cmp(nb);
        }
    }
    Ordering::Equal
}
