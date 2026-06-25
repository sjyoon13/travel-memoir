export interface GeoResult {
  location: string;
  countryCode: string | null;
}

// OpenStreetMap Nominatim으로 GPS → { location, countryCode } 변환
// accept-language=ko: 국가명을 Nominatim이 한국어로 반환 (예: "대한민국", "포르투갈")
// country_code: Nominatim이 항상 ISO alpha-2로 반환 → 텍스트 매핑 불필요
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "travel-memoir-app" } }
    );
    const data = await res.json();
    const { city, town, village, state, country, country_code } = data.address ?? {};
    const region = city ?? town ?? village ?? state;
    const location = country && region
      ? `${country} > ${region}`
      : (country ?? region ?? "알 수 없는 위치");
    return {
      location,
      countryCode: country_code ? (country_code as string).toUpperCase() : null,
    };
  } catch {
    return { location: "알 수 없는 위치", countryCode: null };
  }
}
