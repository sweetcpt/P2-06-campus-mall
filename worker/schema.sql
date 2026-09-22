CREATE TABLE IF NOT EXISTS participant_records (
  study_key TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A','B')),
  status TEXT NOT NULL,
  started_at TEXT,
  cart_opened_at TEXT,
  baseline_value REAL,
  final_value REAL,
  addon_value REAL,
  initial_quantity INTEGER,
  final_quantity INTEGER,
  continued_add INTEGER NOT NULL DEFAULT 0,
  checkout_clicked INTEGER NOT NULL DEFAULT 0,
  free_shipping INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  cart_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (study_key, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_records_study_variant ON participant_records(study_key, variant);
CREATE INDEX IF NOT EXISTS idx_records_study_status ON participant_records(study_key, status);
