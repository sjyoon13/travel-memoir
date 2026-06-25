# travel-memoir

여행 사진을 업로드하면 날짜 기준으로 앨범을 자동 생성하고, AI가 태그와 회고록을 작성해주는 개인 여행 기록 앱.

## 주요 기능

- 사진 드래그 앤 드롭 업로드 — EXIF 날짜 기준으로 여행 자동 분류 (3일 이상 공백이면 별도 여행)
- AI 태그 자동 생성 + 한국어 여행 회고록 작성 (Google Gemini)
- 역지오코딩으로 촬영 장소 자동 인식 (Nominatim / OpenStreetMap)
- 지도 뷰 — GPS 좌표 기반 사진 마커 (Leaflet)
- 세계 지도 뷰 — 방문 국가 하이라이트 (react-simple-maps)
- 연도\_나라 형식 폴더 자동 그룹핑 (예: `2025_포르투갈`)
- 여행 이름 인라인 편집, 삭제

## 기술 스택

- Next.js 16 (App Router) / React 19 / Tailwind CSS v4
- Turso (libSQL) — 사진 data URI 직접 저장
- Google Gemini (`gemini-3-flash-preview`) — 태그 생성 + 회고록 작성
- sharp + heic-convert — 이미지 압축 및 HEIC 변환
- Render.com 배포

## 로컬 실행

```bash
npm install
npm run dev
```

환경 변수 설정 필요:

```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
GOOGLE_GENERATIVE_AI_API_KEY=
```

첫 실행 후 `POST /api/init` 한 번 호출해 DB 테이블을 생성해야 합니다.
