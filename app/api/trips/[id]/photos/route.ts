import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractMeta } from "@/lib/exif";
import { reverseGeocode } from "@/lib/geocode";
import { generateTags, generateRegionName, QuotaExceededError, QUOTA_EXCEEDED_MESSAGE } from "@/lib/claude";
import { compressToDataUri } from "@/lib/image";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trip = await db.execute({ sql: "SELECT id FROM trips WHERE id = ?", args: [id] });
  if (trip.rows.length === 0) {
    return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
  }

  try { await db.execute("ALTER TABLE photos ADD COLUMN country_code TEXT"); } catch {}

  try {
    const formData = await req.formData();
    const files = formData.getAll("photos") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
    }

    // Promise.all 대신 순차 처리 — Render 무료 플랜 512MB 메모리 초과 방지
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const [dataUri, meta] = await Promise.all([
        compressToDataUri(buffer, file.type, file.name),
        extractMeta(buffer),
      ]);

      const geocoded = meta.lat && meta.lng ? await reverseGeocode(meta.lat, meta.lng) : null;
      // 쿼터 초과 시 QuotaExceededError throw → 전체 업로드 차단
      const tags = await generateTags(dataUri);

      await db.execute({
        sql: `INSERT INTO photos (trip_id, url, taken_at, lat, lng, location, tags, country_code)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, dataUri, meta.takenAt, meta.lat, meta.lng, geocoded?.location ?? null, JSON.stringify(tags), geocoded?.countryCode ?? null],
      });
    }

    // 사진 EXIF 날짜 기준으로 앨범 기간 갱신
    const dateRows = await db.execute({
      sql: `SELECT MIN(taken_at) AS min_d, MAX(taken_at) AS max_d
            FROM photos WHERE trip_id = ? AND taken_at IS NOT NULL`,
      args: [id],
    });
    const { min_d, max_d } = dateRows.rows[0];
    if (min_d && max_d) {
      await db.execute({
        sql: "UPDATE trips SET start_date = ?, end_date = ? WHERE id = ?",
        args: [min_d, max_d, id],
      });
    }

    // cover_url이 없으면 첫 사진으로 채우기
    await db.execute({
      sql: `UPDATE trips SET cover_url = COALESCE(
              cover_url,
              (SELECT url FROM photos WHERE trip_id = ? ORDER BY created_at ASC LIMIT 1)
            ) WHERE id = ?`,
      args: [id, id],
    });

    // GPS 있는 사진의 location으로 앨범 이름 갱신 (쿼터 초과 시 null 반환)
    const locRows = await db.execute({
      sql: "SELECT location FROM photos WHERE trip_id = ? AND location IS NOT NULL",
      args: [id],
    });
    const locations = locRows.rows.map((r) => r.location as string).filter(Boolean);
    if (locations.length > 0) {
      const newName = await generateRegionName(locations);
      if (newName) {
        await db.execute({ sql: "UPDATE trips SET name = ? WHERE id = ?", args: [newName, id] });
      }
    }

    return NextResponse.json({ success: true, added: files.length });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    console.error(error);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }
}
