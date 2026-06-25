@AGENTS.md

# travel-memoir

여행 사진을 업로드하면 날짜 기준으로 앨범을 자동 생성하고, Google Gemini AI로 태그와 회고록을 작성하는 Next.js 앱.

## 기술 스택

- **Next.js 16** (App Router, Turbopack)
- **React 19.2**, **Tailwind CSS v4**
- **Turso (libSQL)** — DB. 사진은 data URI로 직접 저장 (Cloudflare R2는 보안 문제로 제거됨)
- **Google Gemini** (`gemini-3-flash-preview`, `@google/genai`) — 태그 생성 + 회고록 작성. 파일명은 `lib/claude.ts`지만 실제 구현체는 Gemini
- **sharp** — 업로드 전 이미지 압축 (1920px, JPEG 80%), HEIC는 `heic-convert` 폴백
- **exifr** — EXIF 추출
- **Nominatim** (OpenStreetMap) — 역지오코딩
- **Leaflet + react-leaflet** — 지도 뷰
- **react-simple-maps** — 세계 지도 뷰


## 개발 서버

```bash
npm run dev
```

## 필수 환경 변수

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
GOOGLE_GENERATIVE_AI_API_KEY
```

## DB 스키마

```sql
folders (id, name UNIQUE, created_at)
trips   (id, folder_id → folders, name, location, start_date, end_date, cover_url, summary, created_at)
photos  (id, trip_id → trips ON DELETE CASCADE, url, taken_at, lat, lng, location, tags, created_at)
```

- `photos.url` — data URI (base64 JPEG)
- `photos.tags` — JSON 배열 문자열
- `photos.location` — `"국가 > 도시"` 형식. Nominatim을 `accept-language` 없이 호출하므로 **GPS 현지어**로 저장됨 (예: `"Portugal > Lisboa"`, `"대한민국 > 서울특별시"`)
- `trips.name` — 업로드 시 `photos.location` 기반으로 자동 설정. **현지어 그대로 유지** (한국어 변환 금지)
- `folders.name` — `"연도_한국어국가명"` 형식. `lib/folders.ts`의 `toKoreanCountry()`로 현지어→한국어 변환 후 저장 (예: `"2026_포르투갈"`)

## API 라우트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/trips` | 여행 목록 조회 |
| POST | `/api/trips` | 신규 여행 생성 |
| GET | `/api/trips/[id]` | 여행 상세 조회 |
| PATCH | `/api/trips/[id]` | 여행 이름 수정 |
| DELETE | `/api/trips/[id]` | 여행 삭제 |
| POST | `/api/trips/[id]/photos` | 기존 여행에 사진 추가 |
| POST | `/api/trips/[id]/summary` | AI 회고록 생성 |
| POST | `/api/upload` | 신규 업로드 (날짜 기준 여행 자동 분류) |
| GET | `/api/map` | 세계 지도용 국가별 사진/여행 집계 |
| POST | `/api/preview` | 업로드 전 미리보기용 소형 JPEG 생성 (400px) |
| POST | `/api/init` | DB 초기화 — **첫 배포 후 1회만 호출** |
| POST | `/api/admin/migrate-folders` | 폴더명 한국어 복원 + 기존 앨범명 GPS 현지어로 재지오코딩 — **마이그레이션 시 1회만 호출** |

## 주요 설계 결정

- **사진 업로드는 순차 처리** (`for...of`, `Promise.all` 아님) — Render 무료 플랜 512MB 메모리 초과 방지
- **AI 쿼터(429) 초과 시**: 당일 UTC 날짜를 기록해 이후 호출을 차단, 다음 날 자동 해제
- **AI 503 시**: `generateTags`는 빈 배열 반환 후 업로드 계속, `generateSummary`는 사용자에게 안내
- **사진 시간**: 아이폰은 해외 촬영 시에도 EXIF DateTimeOriginal을 KST 벽시계 시간으로 기록. exifr가 이를 로컬 Date로 파싱하므로, Render 서버(KST 환경)에서 `.toISOString()` 호출 시 KST → UTC 변환이 정상 동작함. GPS 좌표는 위치 정보(역지오코딩)에만 사용되며 시간 변환과 무관
- **여행 자동 분류**: 사진 간격 3일 이상이면 별도 여행으로 분리 (`lib/grouping.ts`)
- **폴더 자동 그룹핑**: 업로드 시 `연도_한국어국가명` 형식 폴더 자동 생성·할당 (예: `2026_포르투갈`). `lib/folders.ts`의 `toKoreanCountry()`로 현지어→한국어 변환
- **앨범명(trips.name)은 GPS 현지어**: Nominatim `accept-language` 제거로 현지 언어 그대로 저장. 한국어로 변환하지 말 것 (`"Portugal > Lisboa"`, `"Türkiye > İstanbul"` 등)

## 배포

Render.com (무료 플랜). `render.yaml` 참고.  
첫 배포 후 `POST /api/init` 1회 호출로 DB 테이블 생성 필요.
