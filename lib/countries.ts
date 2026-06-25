// 국가명 매핑 — 단일 소스 (lib/folders.ts, app/api/map/route.ts 공용)

// Nominatim 영어 국가명 → ISO 3166-1 alpha-2
export const COUNTRY_ISO: Record<string, string> = {
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

// ISO alpha-2 → 한국어 이름 (폴더명 + 지도 탭 공통 사용)
export const ISO_KOREAN: Record<string, string> = {
  PT: "포르투갈", FR: "프랑스", IT: "이탈리아", ES: "스페인", DE: "독일",
  GB: "영국", IE: "아일랜드", GR: "그리스", NL: "네덜란드", CH: "스위스",
  AT: "오스트리아", CZ: "체코", HU: "헝가리", HR: "크로아티아", PL: "폴란드",
  BE: "벨기에", DK: "덴마크", SE: "스웨덴", NO: "노르웨이", FI: "핀란드",
  IS: "아이슬란드", TR: "튀르키예", RU: "러시아", JP: "일본", CN: "중국",
  TH: "태국", VN: "베트남", ID: "인도네시아", SG: "싱가포르", MY: "말레이시아",
  PH: "필리핀", KH: "캄보디아", MM: "미얀마", TW: "대만", HK: "홍콩",
  IN: "인도", NP: "네팔", MV: "몰디브", LK: "스리랑카", AE: "아랍에미리트",
  QA: "카타르", JO: "요르단", IL: "이스라엘", MA: "모로코", EG: "이집트",
  KE: "케냐", ZA: "남아프리카공화국", TZ: "탄자니아", US: "미국", CA: "캐나다",
  MX: "멕시코", BR: "브라질", AR: "아르헨티나", PE: "페루", CL: "칠레",
  CO: "콜롬비아", CU: "쿠바", AU: "호주", NZ: "뉴질랜드", FJ: "피지",
  KR: "한국",
};

// ISO alpha-2 → ISO 3166-1 numeric (world-atlas 지도 매핑용)
export const ISO_NUMERIC: Record<string, string> = {
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

// 영어 국가명 → 한국어 이름 변환
export function toKoreanCountry(englishName: string): string | null {
  const iso = COUNTRY_ISO[englishName];
  return iso ? (ISO_KOREAN[iso] ?? null) : null;
}

// ISO_KOREAN 역매핑: 한국어 국가명 → ISO
// + Nominatim이 반환하는 공식 명칭 보충 (ISO_KOREAN의 약칭과 다를 수 있음)
const LOCAL_TO_ISO: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ISO_KOREAN).map(([iso, local]) => [local, iso])),
  "대한민국": "KR", // Nominatim 반환값 ("한국"과 별개)
};

// ISO → 대표 영어 국가명 (COUNTRY_ISO 첫 등장 기준)
const ISO_TO_ENGLISH: Record<string, string> = {};
for (const [english, iso] of Object.entries(COUNTRY_ISO)) {
  if (!ISO_TO_ENGLISH[iso]) ISO_TO_ENGLISH[iso] = english;
}

// 현지어 국가명 → 영어 정규화 (DB 저장값·Nominatim 응답 모두 적용)
export function normalizeCountryName(name: string): string {
  if (COUNTRY_ISO[name]) return name;
  const iso = LOCAL_TO_ISO[name];
  return iso && ISO_TO_ENGLISH[iso] ? ISO_TO_ENGLISH[iso] : name;
}
