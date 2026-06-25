"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import TabNav from "@/app/components/TabNav";

interface Trip {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  summary: string | null;
  folder_name: string | null;
}

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/trips").then((r) => r.json()).then(setTrips);
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // 시작/종료 날짜가 같은 날이면 하루만 표시
  const formatDateRange = (start: string, end: string) => {
    const s = formatDate(start);
    const e = formatDate(end);
    return s === e ? s : `${s} – ${e}`;
  };

  const toggleFolder = (name: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // 폴더별 그룹핑 (folder_name 기준, null은 마지막)
  const folderMap = new Map<string, Trip[]>();
  for (const trip of trips) {
    const key = trip.folder_name ?? "";
    if (!folderMap.has(key)) folderMap.set(key, []);
    folderMap.get(key)!.push(trip);
  }
  const folderEntries = [...folderMap.entries()].sort(([a], [b]) => {
    if (!a) return 1;
    if (!b) return -1;
    return b.localeCompare(a);
  });

  const TripCard = ({ trip }: { trip: Trip }) => (
    <div className="relative h-full">
      {/* 포스트잇 — 카드 우측 모서리 */}
      {!trip.summary && (
        <div
          className="absolute top-5 -right-2 z-20 pointer-events-none select-none"
          style={{ transform: "rotate(7deg)" }}
        >
          {/* 블러 그림자 */}
          <div style={{
            position: "absolute",
            top: "4px", left: "4px", right: "-4px", bottom: "-6px",
            background: "rgba(0,0,0,0.22)",
            filter: "blur(5px)",
            zIndex: -1,
          }} />
          {/* 접착 줄 */}
          <div style={{
            height: "10px",
            background: "linear-gradient(to bottom, #7c2d12, #b45309)",
            borderRadius: "2px 2px 0 0",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
          }} />
          {/* 노트 본문 */}
          <div style={{
            position: "relative",
            width: "46px",
            height: "46px",
            background: "linear-gradient(145deg, #fefce8 0%, #fef9c3 40%, #fef08a 75%, #fde047 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
          }}>
            ❓
            {/* 접힌 모서리 — 종이 뒷면 */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: "18px", height: "18px",
              background: "linear-gradient(to top left, #b0b0b0 0%, #d0d0d0 40%, #ededed 47%, transparent 50%)",
            }} />
            {/* 접힌 모서리 — 크리스 그림자 */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: "18px", height: "18px",
              background: "linear-gradient(to top left, transparent 42%, rgba(0,0,0,0.14) 43%, rgba(0,0,0,0.1) 49%, transparent 51%)",
            }} />
          </div>
        </div>
      )}
      <Link href={`/trips/${trip.id}`} className="block h-full">
        <div className="h-full flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-white/60">
          {/* 커버 이미지 */}
          <div className="relative h-44 sm:h-48 bg-sky-100/60 overflow-hidden flex-shrink-0">
            {trip.cover_url ? (
              <img src={trip.cover_url} alt={trip.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🏔️</div>
            )}
          </div>
          {/* 텍스트 */}
          <div className="flex flex-col flex-1 p-4">
            <h2 className="font-semibold text-stone-800 text-base sm:text-lg leading-snug line-clamp-1">{trip.name}</h2>
            <p className="text-stone-500 text-xs sm:text-sm mt-1">{formatDateRange(trip.start_date, trip.end_date)}</p>
            <div className="flex-1 mt-2">
              {trip.summary ? (
                <p className="text-stone-600 text-sm line-clamp-2">{trip.summary}</p>
              ) : (
                <p className="text-stone-400 text-sm italic">아직 회고록이 없어요.</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 drop-shadow-sm">✈️ 여행 회고록</h1>
            <p className="text-stone-600 mt-1 text-sm sm:text-base">사진으로 기록된 나의 여행들</p>
          </div>
          <Link
            href="/upload"
            className="shrink-0 bg-blue-700/90 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl hover:bg-blue-800 transition shadow-sm backdrop-blur-sm text-sm sm:text-base"
          >
            + 앨범 만들기
          </Link>
        </div>

        {/* 탭 네비게이션 */}
        <TabNav />

        {trips.length === 0 ? (
          <div className="text-center py-24 text-stone-400">
            <p className="text-5xl mb-4">🗺️</p>
            <p>아직 기록된 여행이 없습니다.</p>
            <Link href="/upload" className="mt-4 inline-block text-blue-700 underline">
              첫 번째 여행을 기록해보세요
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {folderEntries.map(([folderName, folderTrips]) => {
              const isCollapsed = collapsedFolders.has(folderName);

              // 폴더 전체 기간 계산 (가장 이른 시작 ~ 가장 늦은 종료)
              const folderStart = [...folderTrips].sort((a, b) =>
                a.start_date.localeCompare(b.start_date)
              )[0].start_date;
              const folderEnd = [...folderTrips].sort((a, b) =>
                b.end_date.localeCompare(a.end_date)
              )[0].end_date;

              return (
                <div key={folderName || "ungrouped"}>
                  {folderName && (
                    <button
                      onClick={() => toggleFolder(folderName)}
                      className="flex items-start gap-2 mb-4 w-full text-left group min-w-0"
                    >
                      <span className="text-xl shrink-0 mt-0.5">📁</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h2 className="text-base sm:text-lg font-semibold text-stone-700 truncate">{folderName}</h2>
                          <span className="text-stone-400 text-sm shrink-0">({folderTrips.length})</span>
                          <span className="text-stone-400 text-xs sm:text-sm shrink-0 hidden sm:inline">
                            · {formatDateRange(folderStart, folderEnd)}
                          </span>
                        </div>
                        <p className="text-stone-400 text-xs mt-0.5 sm:hidden">
                          {formatDateRange(folderStart, folderEnd)}
                        </p>
                      </div>
                      <span
                        className="text-stone-400 text-xs transition-transform duration-200 shrink-0 mt-1"
                        style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                      >
                        ▶
                      </span>
                    </button>
                  )}

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 gap-y-6">
                      {folderTrips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
