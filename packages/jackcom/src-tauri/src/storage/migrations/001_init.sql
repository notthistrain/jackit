-- 会话表：每次打开串口创建一个 session
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    port_name   TEXT    NOT NULL,
    baud_rate   INTEGER NOT NULL,
    config_json TEXT    NOT NULL DEFAULT '{}',
    started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT
);

-- 帧表：收发的每一帧数据
CREATE TABLE IF NOT EXISTS frames (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
    direction   TEXT    NOT NULL CHECK (direction IN ('tx', 'rx')),
    raw_data    BLOB    NOT NULL,
    protocol    TEXT    NOT NULL DEFAULT 'raw',
    formatted   TEXT    NOT NULL DEFAULT '',
    summary     TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 索引：按会话 + 时间查询帧
CREATE INDEX IF NOT EXISTS idx_frames_session_time
    ON frames(session_id, timestamp);

-- 索引：按方向查询
CREATE INDEX IF NOT EXISTS idx_frames_direction
    ON frames(direction);

-- 索引：按协议查询
CREATE INDEX IF NOT EXISTS idx_frames_protocol
    ON frames(protocol);
