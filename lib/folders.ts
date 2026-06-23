import { db } from "@/lib/db";

const COUNTRY_MAP: Record<string, string> = {
  "Portugal": "포르투갈",
  "France": "프랑스",
  "Italy": "이탈리아",
  "Spain": "스페인",
  "Germany": "독일",
  "United Kingdom": "영국",
  "England": "영국",
  "Scotland": "스코틀랜드",
  "Ireland": "아일랜드",
  "Greece": "그리스",
  "Netherlands": "네덜란드",
  "Switzerland": "스위스",
  "Austria": "오스트리아",
  "Czech Republic": "체코",
  "Czechia": "체코",
  "Hungary": "헝가리",
  "Croatia": "크로아티아",
  "Poland": "폴란드",
  "Belgium": "벨기에",
  "Denmark": "덴마크",
  "Sweden": "스웨덴",
  "Norway": "노르웨이",
  "Finland": "핀란드",
  "Iceland": "아이슬란드",
  "Turkey": "튀르키예",
  "Türkiye": "튀르키예",
  "Russia": "러시아",
  "Japan": "일본",
  "China": "중국",
  "Thailand": "태국",
  "Vietnam": "베트남",
  "Indonesia": "인도네시아",
  "Singapore": "싱가포르",
  "Malaysia": "말레이시아",
  "Philippines": "필리핀",
  "Cambodia": "캄보디아",
  "Myanmar": "미얀마",
  "Taiwan": "대만",
  "Hong Kong": "홍콩",
  "India": "인도",
  "Nepal": "네팔",
  "Maldives": "몰디브",
  "Sri Lanka": "스리랑카",
  "United Arab Emirates": "아랍에미리트",
  "UAE": "아랍에미리트",
  "Qatar": "카타르",
  "Jordan": "요르단",
  "Israel": "이스라엘",
  "Morocco": "모로코",
  "Egypt": "이집트",
  "Kenya": "케냐",
  "South Africa": "남아프리카공화국",
  "Tanzania": "탄자니아",
  "United States": "미국",
  "USA": "미국",
  "Canada": "캐나다",
  "Mexico": "멕시코",
  "Brazil": "브라질",
  "Argentina": "아르헨티나",
  "Peru": "페루",
  "Chile": "칠레",
  "Colombia": "콜롬비아",
  "Cuba": "쿠바",
  "Australia": "호주",
  "New Zealand": "뉴질랜드",
  "Fiji": "피지",
};

// location("Portugal > Lagoa")과 startDate(UTC ISO)에서 폴더명 생성
export function buildFolderName(location: string | null, startDate: string): string | null {
  if (!location) return null;
  const country = location.split(">")[0].trim();
  if (!country) return null;
  const year = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date(startDate));
  const koreanCountry = COUNTRY_MAP[country] ?? country;
  return `${year}_${koreanCountry}`;
}

// 폴더명으로 기존 폴더 조회 또는 새로 생성
export async function getOrCreateFolder(name: string): Promise<number> {
  const existing = await db.execute({
    sql: "SELECT id FROM folders WHERE name = ?",
    args: [name],
  });
  if (existing.rows.length > 0) return Number(existing.rows[0].id);
  const result = await db.execute({
    sql: "INSERT INTO folders (name) VALUES (?)",
    args: [name],
  });
  return Number(result.lastInsertRowid);
}

// trip에 폴더 자동 할당
export async function assignFolder(tripId: number, location: string | null, startDate: string) {
  const name = buildFolderName(location, startDate);
  if (!name) return;
  const folderId = await getOrCreateFolder(name);
  await db.execute({
    sql: "UPDATE trips SET folder_id = ? WHERE id = ?",
    args: [folderId, tripId],
  });
}
