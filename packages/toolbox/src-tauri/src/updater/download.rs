use std::fs;
use std::io::{self, Write};
use reqwest::blocking::Client;

use crate::config::Config;
use super::UpdateProgress;

struct ProgressWriter<W: Write> {
    inner: W,
    total: u64,
    read: u64,
    last_percent: i32,
    on_progress: Box<dyn Fn(UpdateProgress)>,
}

impl<W: Write> Write for ProgressWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.read += n as u64;
        if self.total > 0 {
            let percent = (self.read as f64 / self.total as f64 * 100.0) as i32;
            if percent != self.last_percent && percent % 5 == 0 {
                (self.on_progress)(UpdateProgress {
                    status: "downloading".into(),
                    progress: percent,
                    message: format!("下载中 {}%", percent),
                    version: None,
                });
                self.last_percent = percent;
            }
        }
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

pub fn download_update(
    cfg: &Config,
    version_id: i64,
    size: i64,
    exe_path: &str,
    on_progress: Box<dyn Fn(UpdateProgress)>,
) -> Result<String, String> {
    let new_path = format!("{}.new", exe_path);

    let url = crate::fs::install::get_signed_url(
        &cfg.server.address,
        cfg.server.s3_port,
        version_id,
    )?;

    on_progress(UpdateProgress {
        status: "downloading".into(),
        progress: 0,
        message: "开始下载更新".into(),
        version: None,
    });

    let resp = Client::new().get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("download failed: {}", resp.status()));
    }

    let file = fs::File::create(&new_path).map_err(|e| e.to_string())?;
    let mut writer = ProgressWriter {
        inner: file,
        total: size as u64,
        read: 0,
        last_percent: 0,
        on_progress,
    };

    let mut reader = resp;
    io::copy(&mut reader, &mut writer).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;

    // Notify completion
    let new_path_clone = new_path.clone();
    // Re-emit is done by the caller via Tauri events after this returns

    Ok(new_path_clone)
}
