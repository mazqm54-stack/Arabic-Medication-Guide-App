-- Cloudflare D1 Migration for Dalili Medication Guide
-- Table: requests
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    is_gemini_429 INTEGER NOT NULL DEFAULT 0,
    medicines_count INTEGER DEFAULT 0,
    unclear_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_device_id ON requests(device_id);
CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type);

-- Table: feedback
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    rating TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
