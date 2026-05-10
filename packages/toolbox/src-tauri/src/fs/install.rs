use std::path::Path;
use std::fs;
use std::io::{self, Write};
use reqwest::blocking::Client;

use crate::db::models;

/// Get a signed download URL from the server, rewriting the port to the S3 port.
pub fn get_signed_url(server_addr: &str, s3_port: i32, version_id: i64) -> Result<String, String> {
    let url = format!("{}/api/tools/download/{}", server_addr, version_id);
    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("API returned {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let download_url = body["data"]["url"].as_str().unwrap_or("").to_string();
    if download_url.is_empty() {
        return Err("empty download URL".into());
    }

    let mut parsed = url::Url::parse(&download_url).map_err(|e| e.to_string())?;
    let server_parsed = url::Url::parse(server_addr).map_err(|e| e.to_string())?;
    let host = server_parsed.host_str().unwrap_or("localhost");

    // Replace the port with the S3 port
    parsed.set_port(Some(s3_port as u16)).ok();

    // Ensure host matches server address host
    let final_url = parsed.to_string().replace(
        &format!("://{}:", parsed.host_str().unwrap_or("")),
        &format!("://{}:", host),
    );
    Ok(final_url)
}

struct ProgressWriter<W: Write> {
    inner: W,
    total: u64,
    read: u64,
    last_percent: i32,
    on_progress: Box<dyn Fn(i32)>,
}

impl<W: Write> Write for ProgressWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.read += n as u64;
        if self.total > 0 {
            let percent = (self.read as f64 / self.total as f64 * 100.0) as i32;
            if percent != self.last_percent && percent % 5 == 0 {
                (self.on_progress)(percent);
                self.last_percent = percent;
            }
        }
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

pub fn install_tool(
    server_addr: &str,
    s3_port: i32,
    install_base: &str,
    tool: &models::Tool,
    version: &models::ToolVersion,
    on_progress: Box<dyn Fn(i32)>,
) -> Result<String, String> {
    let dir = Path::new(install_base)
        .join(&tool.display_name)
        .join(&version.sequence);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let file_name = if tool.ext.is_empty() {
        tool.name.clone()
    } else {
        format!("{}.{}", tool.name, tool.ext)
    };
    let file_path = dir.join(&file_name);

    // Skip download if already present
    if version.downloaded && file_path.exists() {
        return Ok(file_path.to_string_lossy().into());
    }

    let download_url = get_signed_url(server_addr, s3_port, version.version_id)?;

    let resp = Client::new().get(&download_url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("download failed: {}", resp.status()));
    }
    let total = version.size as u64;

    let tmp_path = file_path.with_extension("tmp");
    let file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
    let mut writer = ProgressWriter {
        inner: file,
        total,
        read: 0,
        last_percent: 0,
        on_progress,
    };

    let mut reader = resp;
    io::copy(&mut reader, &mut writer).map_err(|e| e.to_string())?;

    fs::rename(&tmp_path, &file_path).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().into())
}
