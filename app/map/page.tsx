"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import TabNav from "@/app/components/TabNav";

const WorldMapView = dynamic(
  () => import("@/app/components/WorldMapView"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-32 text-stone-400">
      <span className="text-4xl animate-bounce">🌍</span>
      <span className="ml-3">지도 불러오는 중...</span>
    </div>
  )}
);

export default function MapPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 drop-shadow-sm">
              🗺️ 세계 지도
            </h1>
            <p className="text-stone-600 mt-1 text-sm sm:text-base">내가 여행한 나라들</p>
          </div>
          <Link
            href="/upload"
            className="shrink-0 bg-blue-700/90 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl hover:bg-blue-800 transition shadow-sm backdrop-blur-sm text-sm sm:text-base"
          >
            + 사진 업로드
          </Link>
        </div>

        {/* 탭 네비게이션 */}
        <TabNav />

        {/* 세계 지도 뷰 */}
        <WorldMapView />
      </div>
    </main>
  );
}
