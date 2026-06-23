import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Nominatim이 반환하는 국가명 → ISO 3166-1 alpha-2
const COUNTRY_ISO: Record<string, string> = {
  Portugal: "PT", France: "FR", Italy: "IT", Spain: "ES", Germany: "DE",
  "United Kingdom": "GB", England: "GB", Scotland: "GB", Ireland: "IE",
  Greece: "GR", Netherlands: "NL", Switzerland: "CH", Austria: "AT",
  "Czech Republic": "CZ", Czechia: "CZ", Hungary: "HU", Croatia: "HR",
  Poland: "PL", Belgium: "BE", Denmark: "DK", Sweden: "SE", Norway: "NO",
  Finland: "FI", Iceland: "IS", Turkey: "TR", Türkiye: "TR", Russia: "RU",
  Japan: "JP", China: "CN", Thailand: "TH", Vietnam: "VN", Indonesia: "ID",
  Singapore: "SG", Malaysia: "MY", Philippines: "PH", Cambodia: "KH",
  Myanmar: "MM", Taiwan: "TW", "Hong Kong": "HK", India: "IN", Nepal: "NP",
  Maldives: "MV", "Sri Lanka": "LK", "United Arab Emirates": "AE", UAE: "AE",
  Qatar: "QA", Jordan: "JO", Israel: "IL", Morocco: "MA", Egypt: "EG",
  Kenya: "KE", "South Africa": "ZA", Tanzania: "TZ",
  "United States": "US", "United States of America": "US", USA: "US",
  Canada: "CA", Mexico: "MX", Brazil: "BR", Argentina: "AR", Peru: "PE",
  Chile: "CL", Colombia: "CO", Cuba: "CU", Australia: "AU",
  "New Zealand": "NZ", Fiji: "FJ", "South Korea": "KR", Korea: "KR",
  "Republic of Korea": "KR",
};

// ISO alpha-2 → 한국어 이름
const ISO_KOREAN: Record<string, string> = {
  PT: "포르투갈", FR: "프랑스", IT: "이탈리아", ES: "스페인", DE: "독일",
  GB: "영국", IE: "아일랜드", GR: "그리스", NL: "네덜란드", CH: "스위스",
  AT: "오스트리아", CZ: "체코", HU: "헝가리", HR: "크로아티아", PL: "폴란드",
  BE: "벨기에", DK: "덴마크", SE: "스웨덴", NO: "노르웨이", FI: "핀란드",
  IS: "아이슬란드", TR: "튀르키예", RU: "러시아", JP: "일본", CN: "중국",
  TH: "태국", VN: "베트남", ID: "인도네시아", SG: "싱가포르", MY: "말레이시아",
  PH: "필리핀", KH: "캄보디아", MM: "미얀마", TW: "대만", HK: "홍콩",
  IN: "인도", NP: "네팔", MV: "몰디브", LK: "스리랑카", AE: "아랍에미리트",
  QA: "카타르", JO: "요르단", IL: "이스라엘", MA: "모로코", EG: "이집트",
  KE: "케냐", ZA: "남아공", TZ: "탄자니아", US: "미국", CA: "캐나다",
  MX: "멕시코", BR: "브라질", AR: "아르헨티나", PE: "페루", CL: "칠레",
  CO: "콜롬비아", CU: "쿠바", AU: "호주", NZ: "뉴질랜드", FJ: "피지",
  KR: "한국",
};

// ISO alpha-2 → ISO 3166-1 numeric (world-atlas 지도 매핑용)
const ISO_NUMERIC: Record<string, string> = {
  PT: "620", FR: "250", IT: "380", ES: "724", DE: "276", GB: "826",
  IE: "372", GR: "300", NL: "528", CH: "756", AT: "40",  CZ: "203",
  HU: "348", HR: "191", PL: "616", BE: "56",  DK: "208", SE: "752",
  NO: "578", FI: "246", IS: "352", TR: "792", RU: "643", JP: "392",
  CN: "156", TH: "764", VN: "704", ID: "360", SG: "702", MY: "458",
  PH: "608", KH: "116", MM: "104", TW: "158", HK: "344", IN: "356",
  NP: "524", MV: "462", LK: "144", AE: "784", QA: "634", JO: "400",
  IL: "376", MA: "504", EG: "818", KE: "404", ZA: "710", TZ: "834",
  US: "840", CA: "124", MX: "484", BR: "76",  AR: "32",  PE: "604",
  CL: "152", CO: "170", CU: "192", AU: "36",  NZ: "554", FJ: "242",
  KR: "410",
};

// 국가별 고정 색상 (알파벳 순서로 할당되므로 안정적)
const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#F9CA24",
  "#DDA0DD", "#82E0AA", "#F0A500", "#BB8FCE", "#73C6B6",
  "#F1948A", "#85C1E9", "#A9CCE3", "#FAD7A0", "#A3E4D7",
  "#D2B4DE", "#AED6F1", "#A9DFBF", "#F9E79F", "#FFEAA7",
  "#FF8C42", "#2ECC71", "#3498DB", "#9B59B6", "#E74C3C",
];

export async function GET() {
  const result = await db.execute(`
    SELECT
      p.lat, p.lng,
      p.location  AS photo_location,
      t.id        AS trip_id,
      t.name      AS trip_name,
      t.location  AS trip_location
    FROM photos p
    JOIN trips t ON p.trip_id = t.id
    WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
  `);

  // ISO 코드별 집계
  const countryMap = new Map<string, {
    isoCode: string;
    points: [number, number][];
    tripSet: Set<number>;
    trips: { id: number; name: string }[];
  }>();

  for (const row of result.rows) {
    const loc =
      (row.photo_location as string | null) ||
      (row.trip_location as string | null) ||
      "";
    const countryRaw = loc.split(">")[0].trim();
    const isoCode = COUNTRY_ISO[countryRaw];
    if (!isoCode) continue;

    if (!countryMap.has(isoCode)) {
      countryMap.set(isoCode, { isoCode, points: [], tripSet: new Set(), trips: [] });
    }
    const entry = countryMap.get(isoCode)!;
    entry.points.push([row.lat as number, row.lng as number]);

    const tid = row.trip_id as number;
    if (!entry.tripSet.has(tid)) {
      entry.tripSet.add(tid);
      entry.trips.push({ id: tid, name: row.trip_name as string });
    }
  }

  // 한국어 이름 기준 정렬 후 색상 할당
  const countries = [...countryMap.values()]
    .map((c) => ({
      isoCode: c.isoCode,
      koreanName: ISO_KOREAN[c.isoCode] ?? c.isoCode,
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

  return NextResponse.json({ countries });
}
