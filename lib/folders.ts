import { db } from "@/lib/db";
import { toKoreanCountry } from "@/lib/countries";

// location("Portugal > Lagoa")과 startDate(UTC ISO)에서 폴더명 생성
// 폴더명은 한국어 유지 — toKoreanCountry로 현지어→한국어 변환
export function buildFolderName(location: string | null, startDate: string): string | null {
  if (!location) return null;
  const country = location.split(">")[0].trim();
  if (!country) return null;
  const year = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date(startDate));
  const koreanCountry = toKoreanCountry(country) ?? country;
  return `${year}_${koreanCountry}`;
}

// 폴더명으로 기존 폴더 조회 또는 새로 생성
export async function getOrCreateFolder(name: string): Promise<number> {
  const existing = await db.execute({
    sql: "SELECT id FROM folders WHERE name = ?",
    args: [name],
  });
  if (existing.rows.length > 0) return Number(existing.rows[0].id);
  const result = await db.execute({
    sql: "INSERT INTO folders (name) VALUES (?)",
    args: [name],
  });
  return Number(result.lastInsertRowid);
}

// trip에 폴더 자동 할당
export async function assignFolder(tripId: number, location: string | null, startDate: string) {
  const name = buildFolderName(location, startDate);
  if (!name) return;
  const folderId = await getOrCreateFolder(name);
  await db.execute({
    sql: "UPDATE trips SET folder_id = ? WHERE id = ?",
    args: [folderId, tripId],
  });
}
