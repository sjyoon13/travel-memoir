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
    <Link href={`/trips/${trip.id}`}>
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-white/60">
        <div className="h-48 bg-sky-100/60 overflow-hidden">
          {trip.cover_url ? (
            <img src={trip.cover_url} alt={trip.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🏔️</div>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-semibold text-stone-800 text-lg">{trip.name}</h2>
          <p className="text-stone-600 text-sm mt-1">
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
          {trip.summary && (
            <p className="text-stone-600 text-sm mt-2 line-clamp-2">{trip.summary}</p>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-stone-800 drop-shadow-sm">✈️ 여행 회고록</h1>
            <p className="text-stone-600 mt-1">사진으로 기록된 나의 여행들</p>
          </div>
          <Link
            href="/upload"
            className="bg-blue-700/90 text-white px-5 py-2.5 rounded-xl hover:bg-blue-800 transition shadow-sm backdrop-blur-sm"
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
          <div className="space-y-8">
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
                      className="flex items-center gap-2 mb-4 w-full text-left group"
                    >
                      <span className="text-xl">📁</span>
                      <h2 className="text-lg font-semibold text-stone-700">{folderName}</h2>
                      <span className="text-stone-400 text-sm">({folderTrips.length})</span>
                      <span className="text-stone-400 text-sm">
                        · {formatDateRange(folderStart, folderEnd)}
                      </span>
                      {/* 접기/펼치기 화살표 */}
                      <span
                        className="ml-auto text-stone-400 text-xs transition-transform duration-200"
                        style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                      >
                        ▶
                      </span>
                    </button>
                  )}

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
