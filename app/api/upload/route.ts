import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractMeta } from "@/lib/exif";
import { reverseGeocode } from "@/lib/geocode";
import { generateTags, QuotaExceededError, QUOTA_EXCEEDED_MESSAGE } from "@/lib/claude";
import { groupIntoTrips } from "@/lib/grouping";
import { compressToDataUri } from "@/lib/image";
import { assignFolder } from "@/lib/folders";

export async function POST(req: NextRequest) {
  // country_code 컬럼 마이그레이션 (최초 1회, 이미 있으면 무시)
  try { await db.execute("ALTER TABLE photos ADD COLUMN country_code TEXT"); } catch {}

  try {
    const formData = await req.formData();
    const files = formData.getAll("photos") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
    }

    // 1. 각 사진 처리 (압축 + EXIF + 역지오코딩 + AI 태깅)
    // Promise.all 대신 순차 처리 — Render 무료 플랜 512MB 메모리 초과 방지
    const processedPhotos = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      console.log("[upload] compressing", file.name);
      const [dataUri, meta] = await Promise.all([
        compressToDataUri(buffer, file.type, file.name),
        extractMeta(buffer),
      ]);
      console.log("[upload] compressed, dataUri length:", dataUri.length);

      const geocoded = meta.lat && meta.lng ? await reverseGeocode(meta.lat, meta.lng) : null;

      console.log("[upload] generating tags");
      // 쿼터 초과 시 QuotaExceededError throw → 전체 업로드 차단
      const tags = await generateTags(dataUri);
      console.log("[upload] tags:", tags);

      processedPhotos.push({
        url: dataUri,
        takenAt: meta.takenAt,
        lat: meta.lat,
        lng: meta.lng,
        location: geocoded?.location ?? null,
        countryCode: geocoded?.countryCode ?? null,
        tags,
      });
    }

    // 2. 날짜 기준으로 여행 그룹 묶기
    const tripGroups = groupIntoTrips(processedPhotos);

    // 3. DB에 여행 + 사진 저장
    for (const group of tripGroups) {
      const tripResult = await db.execute({
        sql: `INSERT INTO trips (name, location, start_date, end_date, cover_url)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          group.location ?? "미분류 여행",
          group.location,
          group.startDate,
          group.endDate,
          group.photos[0]?.url ?? null,
        ],
      });

      const tripId = Number(tripResult.lastInsertRowid ?? 0);

      await assignFolder(tripId, group.location ?? null, group.startDate);

      for (const photo of group.photos) {
        await db.execute({
          sql: `INSERT INTO photos (trip_id, url, taken_at, lat, lng, location, tags, country_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            tripId,
            photo.url,
            photo.takenAt,
            photo.lat,
            photo.lng,
            photo.location,
            JSON.stringify(photo.tags),
            photo.countryCode,
          ],
        });
      }
    }

    return NextResponse.json({ success: true, trips: tripGroups.length });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    return NextResponse.json({ error: "업로드 실패", detail: message }, { status: 500 });
  }
}
