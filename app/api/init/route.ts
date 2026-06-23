import { NextResponse } from "next/server";
import { initDb, db } from "@/lib/db";
import { assignFolder } from "@/lib/folders";

export async function POST() {
  await initDb();

  // 사진 taken_at 기준으로 모든 trip의 start_date / end_date 재동기화
  await db.execute(`
    UPDATE trips
    SET
      start_date = (
        SELECT MIN(taken_at) FROM photos
        WHERE trip_id = trips.id AND taken_at IS NOT NULL
      ),
      end_date = (
        SELECT MAX(taken_at) FROM photos
        WHERE trip_id = trips.id AND taken_at IS NOT NULL
      )
    WHERE EXISTS (
      SELECT 1 FROM photos WHERE trip_id = trips.id AND taken_at IS NOT NULL
    )
  `);

  // folder_id 없는 기존 여행에 폴더 자동 할당
  const unassigned = await db.execute(
    "SELECT id, location, start_date FROM trips WHERE folder_id IS NULL AND location IS NOT NULL"
  );
  for (const row of unassigned.rows) {
    await assignFolder(Number(row.id), row.location as string, row.start_date as string);
  }

  return NextResponse.json({ success: true, migrated: unassigned.rows.length });
}
