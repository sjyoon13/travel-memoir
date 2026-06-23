"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  type Geo,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Country {
  isoCode: string;
  koreanName: string;
  numericCode: string;
  color: string;
  photoCount: number;
  tripCount: number;
  points: [number, number][];
  trips: { id: number; name: string }[];
}

// ISO alpha-2 → Twemoji 국기 이미지 (Windows에서도 국기 이모지로 렌더링)
function FlagEmoji({ isoCode, size = 24 }: { isoCode: string; size?: number }) {
  const codepoints = [...isoCode.toUpperCase()]
    .map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16))
    .join("-");
  const src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
  return (
    <img
      src={src}
      alt={isoCode}
      width={size}
      height={size}
      className="flex-shrink-0 object-contain"
      draggable={false}
    />
  );
}

export default function WorldMapView() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // isoCode | null = 전체
  const [tooltip, setTooltip] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/map")
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // numeric code → color (현재 선택 필터 적용)
  const colorByNumeric = new Map<string, string>();
  const filtered = selected
    ? countries.filter((c) => c.isoCode === selected)
    : countries;
  filtered.forEach((c) => {
    if (c.numericCode) colorByNumeric.set(c.numericCode, c.color);
  });

  // 지도 위 마커 (사진 좌표, 최대 200개 표시)
  const markers = filtered.flatMap((c) =>
    c.points.slice(0, Math.ceil(200 / Math.max(filtered.length, 1))).map(
      ([lat, lng], i) =>
        ({ key: `${c.isoCode}-${i}`, lat, lng, color: c.color }) as const
    )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-stone-400">
        <span className="text-4xl animate-bounce">🌍</span>
        <span className="ml-3">지도 불러오는 중...</span>
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="text-center py-24 text-stone-400">
        <p className="text-5xl mb-4">🌐</p>
        <p>GPS 정보가 있는 사진이 없습니다.</p>
        <p className="text-sm mt-2">사진을 업로드하면 여기에 나라가 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 국가 배너 ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* 전체 버튼 */}
        <button
          onClick={() => setSelected(null)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
            !selected
              ? "bg-blue-700 text-white border-blue-700 shadow-md"
              : "bg-white/80 text-stone-600 border-white/60 hover:bg-white hover:shadow-sm"
          }`}
        >
          <span className="text-base">🌍</span>
          <span>전체</span>
          <span className="text-xs opacity-70">
            ({countries.reduce((s, c) => s + c.photoCount, 0)})
          </span>
        </button>

        {/* 나라별 버튼 */}
        {countries.map((c) => {
          const active = selected === c.isoCode;
          return (
            <button
              key={c.isoCode}
              onClick={() => setSelected(active ? null : c.isoCode)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                active
                  ? "text-white border-transparent shadow-md"
                  : "bg-white/80 text-stone-600 border-white/60 hover:bg-white hover:shadow-sm"
              }`}
              style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
            >
              <FlagEmoji isoCode={c.isoCode} size={22} />
              <span>{c.koreanName}</span>
              <span className="text-xs opacity-70">({c.photoCount})</span>
            </button>
          );
        })}
      </div>

      {/* ── 세계 지도 ── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-lg border border-white/60"
        style={{ background: "linear-gradient(180deg, #bde0f7 0%, #d4eef9 100%)" }}
        onMouseLeave={() => setTooltip(null)}
      >
        <ComposableMap
          projectionConfig={{ scale: 147, center: [10, 10] }}
          width={900}
          height={500}
          className="w-full h-auto"
        >
          <ZoomableGroup zoom={1} minZoom={1} maxZoom={6}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Geo[] }) =>
                geographies.map((geo: Geo) => {
                  const color = colorByNumeric.get(String(geo.id));
                  const hasData = Boolean(color);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={color ?? "#ddd6c8"}
                      stroke="#ffffff"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none", opacity: hasData ? 1 : 0.6 },
                        hover: {
                          fill: hasData ? color + "cc" : "#ccc5b8",
                          outline: "none",
                          cursor: hasData ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                        if (!hasData) return;
                        const country = filtered.find(
                          (c) => c.numericCode === String(geo.id)
                        );
                        if (country) {
                          const rect = (e.target as SVGElement)
                            .closest("svg")
                            ?.getBoundingClientRect();
                          if (rect) {
                            setTooltip({
                              name: country.koreanName,
                              count: country.photoCount,
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top - 10,
                            });
                          }
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (!hasData) return;
                        const country = filtered.find(
                          (c) => c.numericCode === String(geo.id)
                        );
                        if (country)
                          setSelected(
                            selected === country.isoCode ? null : country.isoCode
                          );
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* 사진 위치 마커 */}
            {markers.map(({ key, lat, lng, color }) => (
              <Marker key={key} coordinates={[lng, lat]}>
                <circle
                  r={2.2}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={0.6}
                  opacity={0.85}
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* 호버 툴팁 */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-stone-800/90 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg"
            style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
          >
            <span className="font-semibold">{tooltip.name}</span>
            <span className="ml-2 opacity-75">{tooltip.count}장</span>
          </div>
        )}

        {/* 줌 힌트 */}
        <div className="absolute bottom-3 right-4 text-xs text-stone-500/70 pointer-events-none">
          스크롤로 확대 · 드래그로 이동
        </div>
      </div>

      {/* ── 나라별 카드 요약 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((c) => (
          <button
            key={c.isoCode}
            onClick={() => setSelected(selected === c.isoCode ? null : c.isoCode)}
            className={`flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl p-3 text-left transition-all hover:bg-white hover:shadow-md border ${
              selected === c.isoCode
                ? "border-2 shadow-md"
                : "border-white/60"
            }`}
            style={
              selected === c.isoCode ? { borderColor: c.color } : {}
            }
          >
            <FlagEmoji isoCode={c.isoCode} size={34} />
            <div className="min-w-0">
              <p className="font-semibold text-stone-800 text-sm truncate">
                {c.koreanName}
              </p>
              <p className="text-xs text-stone-500">
                📷 {c.photoCount}장 · 🗺 {c.tripCount}번
              </p>
            </div>
            <div
              className="ml-auto w-2 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: c.color }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
