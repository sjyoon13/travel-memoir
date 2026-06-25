import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COUNTRY_ISO, ISO_KOREAN, ISO_NUMERIC, normalizeCountryName } from "@/lib/countries";

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#F9CA24",
  "#DDA0DD", "#82E0AA", "#F0A500", "#BB8FCE", "#73C6B6",
  "#F1948A", "#85C1E9", "#A9CCE3", "#FAD7A0", "#A3E4D7",
  "#D2B4DE", "#AED6F1", "#A9DFBF", "#F9E79F", "#FFEAA7",
  "#FF8C42", "#2ECC71", "#3498DB", "#9B59B6", "#E74C3C",
];

export async function GET() {
  // country_code 컬럼 마이그레이션 (최초 1회, 이미 있으면 무시)
  try { await db.execute("ALTER TABLE photos ADD COLUMN country_code TEXT"); } catch {}

  const result = await db.execute(`
    SELECT
      p.lat, p.lng,
      p.location  AS photo_location,
      p.country_code,
      t.id        AS trip_id,
      t.name      AS trip_name,
      t.location  AS trip_location
    FROM photos p
    JOIN trips t ON p.trip_id = t.id
    WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
  `);

  const countryMap = new Map<string, {
    isoCode: string;
    displayName: string;
    points: [number, number][];
    tripSet: Set<number>;
    trips: { id: number; name: string }[];
  }>();

  for (const row of result.rows) {
    const loc =
      (row.photo_location as string | null) ||
      (row.trip_location as string | null) ||
      "";
    const countryPart = loc.split(">")[0].trim();

    // 1순위: DB에 저장된 country_code (신규 업로드)
    let isoCode = (row.country_code as string | null) ?? null;

    // 2순위: 위치 텍스트에서 역매핑 (기존 데이터 폴백)
    if (!isoCode && countryPart) {
      const normalized = normalizeCountryName(countryPart);
      isoCode = COUNTRY_ISO[normalized] ?? null;
    }

    if (!isoCode) continue;

    // 표시 이름: country_code가 있으면 Nominatim이 준 현지어 이름 사용
    // 없으면(기존 영문 데이터) ISO_KOREAN 테이블로 폴백
    let displayName: string;
    if (isoCode && !row.country_code) {
      displayName = ISO_KOREAN[isoCode] || countryPart;
    } else {
      displayName = countryPart || ISO_KOREAN[isoCode] || isoCode;
    }

    if (!countryMap.has(isoCode)) {
      countryMap.set(isoCode, { isoCode, displayName, points: [], tripSet: new Set(), trips: [] });
    }
    const entry = countryMap.get(isoCode)!;
    // 현지어 이름이 생기면 업데이트 (기존 영문 이름보다 우선)
    if (row.country_code && countryPart) entry.displayName = countryPart;

    entry.points.push([row.lat as number, row.lng as number]);

    const tid = row.trip_id as number;
    if (!entry.tripSet.has(tid)) {
      entry.tripSet.add(tid);
      entry.trips.push({ id: tid, name: row.trip_name as string });
    }
  }

  const countries = [...countryMap.values()]
    .map((c) => ({
      isoCode: c.isoCode,
      koreanName: c.displayName,
      numericCode: ISO_NUMERIC[c.isoCode] ?? "",
      photoCount: c.points.length,
      tripCount: c.tripSet.size,
      points: c.points,
      trips: c.trips,
      color: "",
    }))
    .sort((a, b) => a.koreanName.localeCompare(b.koreanName, "ko"));

  countries.forEach((c, i) => {
    c.color = COLORS[i % COLORS.length];
  });

  return NextResponse.json({ countries }, {
    headers: { "Cache-Control": "no-store" },
  });
}
