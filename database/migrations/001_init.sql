CREATE TABLE IF NOT EXISTS operation_history (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_operation_history_started_at
  ON operation_history (started_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS managed_targets (
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id, type)
);

