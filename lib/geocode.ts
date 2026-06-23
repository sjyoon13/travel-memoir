// OpenStreetMap Nominatim으로 GPS → "나라 > 도시" 형식 변환 (무료)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "travel-memoir-app" } }
    );
    const data = await res.json();
    const { city, town, village, state, country } = data.address ?? {};
    const region = city ?? town ?? village ?? state;
    if (country && region) return `${country} > ${region}`;
    return country ?? region ?? "알 수 없는 위치";
  } catch {
    return "알 수 없는 위치";
  }
}
