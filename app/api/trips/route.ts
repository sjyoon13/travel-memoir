import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const result = await db.execute(
    `SELECT t.id, t.name, t.location, t.start_date, t.end_date, t.cover_url, t.summary,
            f.name AS folder_name
     FROM trips t
     LEFT JOIN folders f ON t.folder_id = f.id
     ORDER BY f.name DESC, t.start_date DESC`
  );
  return NextResponse.json(result.rows);
}
