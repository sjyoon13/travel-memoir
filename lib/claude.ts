import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const model = "gemini-3-flash-preview";

// ─── 일일 쿼터 서킷 브레이커 ────────────────────────────────────────────────
// 429 발생 시 당일 UTC 날짜를 기록. 날짜가 바뀌면 자동 리셋.
let quotaExceededDate: string | null = null;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isQuotaExceeded(): boolean {
  if (!quotaExceededDate) return false;
  if (quotaExceededDate !== todayUtc()) {
    quotaExceededDate = null;
    return false;
  }
  return true;
}

function markQuotaExceeded(): void {
  quotaExceededDate = todayUtc();
}

function is429(e: unknown): boolean {
  return (e as any)?.status === 429 || String((e as any)?.message).includes("429");
}

export const QUOTA_EXCEEDED_MESSAGE =
  "오늘의 AI 기능 사용량을 모두 소진했습니다.\n내일 다시 시도해주세요! 🙏";

export class QuotaExceededError extends Error {
  constructor() {
    super(QUOTA_EXCEEDED_MESSAGE);
    this.name = "QuotaExceededError";
  }
}

// ─── 유틸 ───────────────────────────────────────────────────────────────────
function parseDataUri(dataUri: string): { data: string; mimeType: string } {
  const [header, data] = dataUri.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  return { data, mimeType };
}

// ─── 태그 생성 (쿼터 초과 시 QuotaExceededError throw → 업로드 전체 차단) ──
export async function generateTags(imageDataUri: string): Promise<string[]> {
  if (isQuotaExceeded()) throw new QuotaExceededError();

  const { data, mimeType } = parseDataUri(imageDataUri);
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { inlineData: { data, mimeType } },
          { text: "이 여행 사진을 보고 한국어 태그를 최대 5개 추출해줘. 쉼표로 구분해서 태그만 출력해. 예: 바다, 일몰, 해변, 여름, 휴양" },
        ],
      }],
    });
    const text = response.text ?? "";
    return text.split(",").map((t) => t.trim()).filter(Boolean);
  } catch (e) {
    if (is429(e)) { markQuotaExceeded(); throw new QuotaExceededError(); }
    throw e;
  }
}

export interface PhotoMeta {
  takenAt: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
}

// ─── 지역명 생성 (쿼터 초과 시 null 반환) ───────────────────────────────────
export async function generateRegionName(locations: string[]): Promise<string | null> {
  if (isQuotaExceeded()) return null;

  const unique = [...new Set(locations)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0].split(">").map((s) => s.trim()).pop() ?? null;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [{
          text: `다음 여행 장소들을 모두 포함하는 지역명을 "나라 > 지역" 형식으로 하나만 답해줘. 입력된 장소 이름과 같은 언어로 써줘. 형식 그대로만 출력하고 설명은 쓰지 마. 예시: Türkiye > Kapadokya\n\n${unique.join("\n")}`,
        }],
      }],
    });
    const name = response.text?.trim().replace(/["""''*]/g, "").split("\n")[0].trim();
    return name || null;
  } catch (e) {
    if (is429(e)) markQuotaExceeded();
    return null;
  }
}

// ─── 회고록 생성 (쿼터 초과 시 에러를 던져 사용자에게 알림) ─────────────────
export async function generateSummary(
  location: string,
  startDate: string,
  endDate: string,
  imageDataUris: string[],
  photoMetas?: PhotoMeta[]
): Promise<string> {
  if (isQuotaExceeded()) throw new QuotaExceededError();

  const images = imageDataUris.slice(0, 10);
  const metas = photoMetas?.slice(0, 10) ?? [];

  const imageParts = images.map((dataUri) => {
    const { data, mimeType } = parseDataUri(dataUri);
    return { inlineData: { data, mimeType } };
  });

  const toKst = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

  const metaText = metas.length > 0
    ? "\n\n각 사진 정보:\n" + metas.map((m, i) => {
        const parts = [];
        if (m.takenAt) parts.push(toKst(m.takenAt));
        if (m.location) parts.push(m.location);
        if (m.lat != null && m.lng != null) parts.push(`GPS(${m.lat.toFixed(4)}, ${m.lng.toFixed(4)})`);
        return `사진 ${i + 1}: ${parts.join(", ") || "정보 없음"}`;
      }).join("\n")
    : "";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          ...imageParts,
          {
            text: `${location}에서 ${startDate}부터 ${endDate}까지의 여행 사진들이야.${metaText}\n\n사진은 시간 순서대로 제공됐어. 반드시 그 순서대로 내용을 전개해줘. 각 사진의 날짜·시간과 장소를 회고록에 자연스럽게 녹여서 써줘. 제공된 시간은 현지 시간이야. 절대 다른 시간대로 변환하지 마. GPS 좌표나 "(한국 시간)" 같은 표현은 절대 쓰지 마. 예를 들어 "오전 10시, 에펠탑 앞에서..." 처럼 자연스럽게 써야 해. 첫 문장은 매번 같은 표현으로 시작하지 말고, 장면 묘사·날씨·감각·대화·감정 등 다양한 방식으로 시작해. 친구에게 말하듯 반말로, 블로그 느낌의 친근한 한국어 회고록 2문단으로 작성해줘.`,
          },
        ],
      }],
    });
    return response.text ?? "";
  } catch (e) {
    if (is429(e)) { markQuotaExceeded(); throw new QuotaExceededError(); }
    throw e;
  }
}
