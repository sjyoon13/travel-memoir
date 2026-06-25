import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toKoreanCountry } from "@/lib/countries";
import { reverseGeocode } from "@/lib/geocode";

// 폴더명을 한국어로 복원하고, 앨범명(trips.name/location)을 GPS 현지어로 업데이트
// 첫 배포 후 1회만 호출
export async function POST() {
  const log: string[] = [];

  // 1. 폴더명을 한국어로 복원 (영문으로 잘못 변경된 것 되돌리기)
  const folders = await db.execute("SELECT id, name FROM folders");
  for (const row of folders.rows) {
    const name = String(row.name);
    const underscoreIdx = name.indexOf("_");
    if (underscoreIdx === -1) continue;

    const year = name.slice(0, underscoreIdx);
    const country = name.slice(underscoreIdx + 1);
    const korean = toKoreanCountry(country) ?? country;
    const newName = `${year}_${korean}`;

    if (newName !== name) {
      const existing = await db.execute({
        sql: "SELECT id FROM folders WHERE name = ?",
        args: [newName],
      });
      if (existing.rows.length > 0) {
        const targetId = existing.rows[0].id;
        await db.execute({
          sql: "UPDATE trips SET folder_id = ? WHERE folder_id = ?",
          args: [targetId, row.id],
        });
        await db.execute({ sql: "DELETE FROM folders WHERE id = ?", args: [row.id] });
      } else {
        await db.execute({
          sql: "UPDATE folders SET name = ? WHERE id = ?",
          args: [newName, row.id],
        });
      }
      log.push(`folder: ${name} → ${newName}`);
    }
  }

  // 2. 각 trip의 첫 번째 사진 GPS로 재역지오코딩 → trips.name/location 현지어 업데이트
  const trips = await db.execute(
    `SELECT t.id, t.name, t.location,
            (SELECT lat FROM photos WHERE trip_id = t.id AND lat IS NOT NULL LIMIT 1) AS lat,
            (SELECT lng FROM photos WHERE trip_id = t.id AND lng IS NOT NULL LIMIT 1) AS lng
     FROM trips t`
  );

  for (const trip of trips.rows) {
    const lat = trip.lat ? Number(trip.lat) : null;
    const lng = trip.lng ? Number(trip.lng) : null;
    if (!lat || !lng) continue;

    const geo = await reverseGeocode(lat, lng);
    if (geo.location && geo.location !== trip.location) {
      await db.execute({
        sql: "UPDATE trips SET name = ?, location = ? WHERE id = ?",
        args: [geo.location, geo.location, trip.id],
      });
      log.push(`trip ${trip.id}: "${trip.location}" → "${geo.location}"`);
    }
  }

  return NextResponse.json({ log });
}
