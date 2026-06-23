import exifr from "exifr";

export interface PhotoMeta {
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
}

// 이미지 버퍼에서 날짜·GPS 추출
// 아이폰은 해외에서도 EXIF 시간을 KST로 기록하므로 toISOString()으로 UTC 변환
export async function extractMeta(buffer: Buffer): Promise<PhotoMeta> {
  try {
    const data = await exifr.parse(buffer, { tiff: true, gps: true });
    const lat = data?.latitude ?? null;
    const lng = data?.longitude ?? null;

    const takenAt =
      data?.DateTimeOriginal instanceof Date
        ? data.DateTimeOriginal.toISOString()
        : null;

    return { takenAt, lat, lng };
  } catch {
    return { takenAt: null, lat: null, lng: null };
  }
}
