"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "✈️ 여행 회고록" },
    { href: "/map", label: "🗺️ 세계 지도" },
  ];

  return (
    <div className="flex gap-1 mb-8 bg-white/60 backdrop-blur-sm rounded-xl p-1 w-fit shadow-sm border border-white/60">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              active
                ? "bg-white shadow text-stone-800"
                : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
