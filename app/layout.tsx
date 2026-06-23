import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "여행 회고록",
  description: "사진으로 기록된 나의 여행들",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 여행 테마 장식 레이어 (포인터 이벤트 없음, z-0) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">

          {/* 나침반 — 우측 상단 */}
          <svg
            className="absolute top-6 right-8 w-40 h-40 text-blue-900 opacity-[0.055]"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="60" cy="60" r="36" stroke="currentColor" strokeWidth="0.4" />
            {/* 8방향 눈금선 */}
            <line x1="60" y1="4"   x2="60" y2="116"  stroke="currentColor" strokeWidth="0.5" />
            <line x1="4"  y1="60"  x2="116" y2="60"  stroke="currentColor" strokeWidth="0.5" />
            <line x1="20" y1="20"  x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" />
            <line x1="100" y1="20" x2="20"  y2="100" stroke="currentColor" strokeWidth="0.4" />
            {/* N 방향 (검정 화살) */}
            <polygon points="60,8 54,60 60,50 66,60" fill="currentColor" />
            {/* S 방향 (빈 화살) */}
            <polygon points="60,112 54,60 60,70 66,60" fill="currentColor" opacity="0.35" />
            {/* E/W 방향 (작은 화살) */}
            <polygon points="112,60 60,54 70,60 60,66" fill="currentColor" opacity="0.5" />
            <polygon points="8,60   60,54 50,60 60,66" fill="currentColor" opacity="0.5" />
            {/* 바깥 눈금 (16개) */}
            {[0,22.5,45,67.5,112.5,135,157.5,202.5,225,247.5,292.5,315,337.5].map((deg, i) => {
              const r = Math.PI / 180;
              const x1 = 60 + 46 * Math.sin(deg * r);
              const y1 = 60 - 46 * Math.cos(deg * r);
              const x2 = 60 + 54 * Math.sin(deg * r);
              const y2 = 60 - 54 * Math.cos(deg * r);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.8" />;
            })}
          </svg>

          {/* 항공 경로 점선 + 위치 마커 */}
          <svg
            className="absolute top-0 left-0 w-full text-blue-900 opacity-[0.05]"
            viewBox="0 0 1440 220"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 주 경로 */}
            <path
              d="M -30 170 C 120 90 260 160 440 100 S 680 40 880 130 S 1100 60 1300 110 L 1470 80"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray="12,9"
            />
            {/* 보조 경로 */}
            <path
              d="M -30 60 C 200 120 420 40 620 90 S 840 150 1040 70 S 1250 130 1470 90"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="7,10"
              opacity="0.6"
            />
            {/* 위치 마커 */}
            {[[220,115],[540,88],[860,128],[1120,80]].map(([cx,cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="5.5" fill="currentColor" />
                <circle cx={cx} cy={cy} r="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
              </g>
            ))}
          </svg>

          {/* 산 실루엣 — 하단 */}
          <svg
            className="absolute bottom-0 left-0 w-full text-blue-900 opacity-[0.045]"
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 120 L90 62 L170 88 L290 22 L420 72 L540 8 L660 56 L780 34 L900 78 L1020 18 L1140 64 L1260 40 L1380 82 L1440 50 L1440 120 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* 실제 콘텐츠 */}
        <div className="relative z-10 flex flex-col min-h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
