const TRIP_GAP_DAYS = 3; // 사진 간격이 3일 이상이면 새 여행으로 분리

interface Photo {
  takenAt: string | null;
  location: string | null;
  countryCode: string | null;
  url: string;
  lat: number | null;
  lng: number | null;
  tags: string[];
}

interface TripGroup {
  startDate: string;
  endDate: string;
  location: string;
  photos: Photo[];
}

// 날짜 기준으로 사진을 여행 그룹으로 묶기
export function groupIntoTrips(photos: Photo[]): TripGroup[] {
  // EXIF 날짜 없는 사진은 현재 시각 기준
  const sorted = [...photos].sort((a, b) => {
    const da = a.takenAt ? new Date(a.takenAt).getTime() : Date.now();
    const db = b.takenAt ? new Date(b.takenAt).getTime() : Date.now();
    return da - db;
  });

  const groups: TripGroup[] = [];
  let current: Photo[] = [];

  for (const photo of sorted) {
    if (current.length === 0) {
      current.push(photo);
      continue;
    }

    const prev = current[current.length - 1];
    const prevTime = prev.takenAt ? new Date(prev.takenAt).getTime() : Date.now();
    const currTime = photo.takenAt ? new Date(photo.takenAt).getTime() : Date.now();
    const gapDays = (currTime - prevTime) / (1000 * 60 * 60 * 24);

    if (gapDays >= TRIP_GAP_DAYS) {
      groups.push(toTripGroup(current));
      current = [photo];
    } else {
      current.push(photo);
    }
  }

  if (current.length > 0) groups.push(toTripGroup(current));
  return groups;
}

// 여러 위치 문자열에서 공통 상위 지역 추출
// 예) ["Turkey > Istanbul", "Turkey > Göreme"] → "Turkey"
//     ["Turkey > Istanbul", "Turkey > Istanbul"] → "Turkey > Istanbul"
export function findCommonLocation(locations: string[]): string {
  const valid = locations.filter(Boolean);
  if (valid.length === 0) return "미분류";
  if (valid.length === 1) return valid[0];

  const parts = valid.map((l) => l.split(">").map((s) => s.trim()));
  const depth = Math.min(...parts.map((p) => p.length));

  for (let d = depth; d >= 1; d--) {
    const prefix = parts[0].slice(0, d).join(" > ");
    if (parts.every((p) => p.slice(0, d).join(" > ") === prefix)) return prefix;
  }

  return valid[0];
}

function toTripGroup(photos: Photo[]): TripGroup {
  const dates = photos
    .map((p) => p.takenAt)
    .filter(Boolean)
    .sort() as string[];

  const location = findCommonLocation(photos.map((p) => p.location ?? "").filter(Boolean));

  return {
    startDate: dates[0] ?? new Date().toISOString(),
    endDate: dates[dates.length - 1] ?? new Date().toISOString(),
    location,
    photos,
  };
}
