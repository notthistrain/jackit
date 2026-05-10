use rusqlite::Connection;
use std::sync::Mutex;
use crate::config::Config;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(cfg: &Config) -> Result<Self, String> {
        let db_path = crate::config::get_resolved_db_path(cfg);
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(|e| e.to_string())?;
        let db = Database { conn: Mutex::new(conn) };
        db.create_tables()?;
        Ok(db)
    }

    fn create_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tools (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                identifier TEXT DEFAULT '',
                display_name TEXT DEFAULT '',
                version TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                description TEXT DEFAULT '',
                ext TEXT DEFAULT '',
                file_path TEXT DEFAULT '',
                installed_at TEXT DEFAULT '',
                remote_updated_at TEXT DEFAULT '',
                local_updated_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS tool_versions (
                id INTEGER PRIMARY KEY,
                tool_id INTEGER NOT NULL,
                version_id INTEGER NOT NULL,
                sequence TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                force INTEGER NOT NULL DEFAULT 0,
                changelog TEXT DEFAULT '',
                downloaded INTEGER NOT NULL DEFAULT 0,
                deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT '',
                UNIQUE(tool_id, version_id)
            );",
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}
