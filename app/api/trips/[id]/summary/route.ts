import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSummary, QuotaExceededError, QUOTA_EXCEEDED_MESSAGE } from "@/lib/claude";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, photos] = await Promise.all([
    db.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [id] }),
    db.execute({ sql: "SELECT url, taken_at, location, lat, lng FROM photos WHERE trip_id = ? ORDER BY taken_at ASC", args: [id] }),
  ]);

  if (trip.rows.length === 0) {
    return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
  }

  const t = trip.rows[0];
  const imageUrls = photos.rows.map((p) => p.url as string);
  const photoMetas = photos.rows.map((p) => ({
    takenAt: p.taken_at as string | null,
    location: p.location as string | null,
    lat: p.lat as number | null,
    lng: p.lng as number | null,
  }));

  try {
    const summary = await generateSummary(
      t.location as string,
      t.start_date as string,
      t.end_date as string,
      imageUrls,
      photoMetas
    );

    await db.execute({
      sql: "UPDATE trips SET summary = ? WHERE id = ?",
      args: [summary, id],
    });

    return NextResponse.json({ summary });
  } catch (error) {
    // 일일 무료 쿼터 초과
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    console.error(error);
    return NextResponse.json({ error: "회고록 생성에 실패했습니다." }, { status: 500 });
  }
}
