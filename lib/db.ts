import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// DB 초기화 — 앱 시작 시 1회 실행
export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id  INTEGER REFERENCES folders(id),
      name       TEXT NOT NULL,
      location   TEXT,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      cover_url  TEXT,
      summary    TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id    INTEGER REFERENCES trips(id) ON DELETE CASCADE,
      url        TEXT NOT NULL,
      taken_at   TEXT,
      lat        REAL,
      lng        REAL,
      location   TEXT,
      tags       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 기존 trips 테이블에 folder_id 컬럼 추가 (이미 있으면 무시)
  try {
    await db.execute("ALTER TABLE trips ADD COLUMN folder_id INTEGER REFERENCES folders(id)");
  } catch {
    // 컬럼이 이미 존재하는 경우 무시
  }
}
