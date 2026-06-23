import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, photos] = await Promise.all([
    db.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [id] }),
    db.execute({ sql: "SELECT * FROM photos WHERE trip_id = ? ORDER BY taken_at ASC NULLS LAST, created_at ASC", args: [id] }),
  ]);

  if (trip.rows.length === 0) {
    return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    trip: trip.rows[0],
    photos: photos.rows.map((p) => ({ ...p, tags: JSON.parse((p.tags as string) ?? "[]") })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.cover_url !== undefined) {
    await db.execute({
      sql: "UPDATE trips SET cover_url = ? WHERE id = ?",
      args: [body.cover_url, id],
    });
    return NextResponse.json({ success: true });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "이름이 비어있습니다." }, { status: 400 });
  }

  await db.execute({
    sql: "UPDATE trips SET name = ? WHERE id = ?",
    args: [body.name.trim(), id],
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // photos는 ON DELETE CASCADE로 자동 삭제됨
  await db.execute({ sql: "DELETE FROM trips WHERE id = ?", args: [id] });
  return NextResponse.json({ success: true });
}
