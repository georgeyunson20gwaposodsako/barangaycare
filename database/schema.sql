-- BarangayCare database (SQLite). Open database/barangaycare.db in SQLiteStudio to view and edit it.
-- server.js runs this file automatically if the tables do not exist yet.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,                       -- salt:hash (scrypt), never plain text
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('admin','resident')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS residents (
  id         INTEGER PRIMARY KEY,
  username   TEXT UNIQUE REFERENCES users(username) ON DELETE SET NULL ON UPDATE CASCADE,  -- set when the resident has a login
  name       TEXT NOT NULL,
  age        INTEGER,
  contact    TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id         INTEGER PRIMARY KEY,
  queue_no   INTEGER NOT NULL,
  username   TEXT NOT NULL,
  resident   TEXT NOT NULL,
  service    TEXT NOT NULL,
  appt_date  TEXT NOT NULL,                          -- YYYY-MM-DD
  status     TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Completed','Rejected','Cancelled')),
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_appt_user ON appointments(username);

CREATE TABLE IF NOT EXISTS emergencies (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL,
  reporter    TEXT NOT NULL,
  type        TEXT NOT NULL,
  location    TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal','High','Urgent')),
  details     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Recorded' CHECK (status IN ('Recorded','In progress','Resolved')),
  reported_at TEXT NOT NULL                          -- ISO time in UTC
);
CREATE INDEX IF NOT EXISTS idx_em_user ON emergencies(username);
