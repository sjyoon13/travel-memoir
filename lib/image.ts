import sharp from "sharp";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require("heic-convert");

const HEIC_EXTS = /\.hei[cf]$/i;
const MAX_BYTES = 800 * 1024; // 800KB 초과 시 품질 추가 감소

// HEIC 파일 처리: sharp(libvips 네이티브) → heic-convert 순으로 시도
// heic-convert의 libheif는 일부 HEIF 변종(HDR, 특정 제조사 포맷)을 지원하지 않으므로
// sharp를 먼저 시도해 ERR_LIBHEIF format not supported 오류를 우회
async function toJpegBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<Buffer> {
  const isHeic = mimeType === "image/heic" || mimeType === "image/heif" || HEIC_EXTS.test(fileName);
  if (!isHeic) return buffer;

  try {
    await sharp(buffer).metadata();
    return buffer; // sharp가 직접 읽을 수 있으면 원본 그대로 전달
  } catch {
    // sharp도 처리 불가한 경우 heic-convert로 폴백
    const output = await heicConvert({ buffer, format: "JPEG", quality: 1 });
    return Buffer.from(output);
  }
}

// 이미지 압축 후 data URI 반환 (최대 1920px, 원본 크면 품질 자동 조정)
export async function compressToDataUri(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const input = await toJpegBuffer(buffer, mimeType, fileName);

  let compressed = await sharp(input)
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // 800KB 초과 시 품질 낮춰 재압축
  if (compressed.length > MAX_BYTES) {
    compressed = await sharp(input)
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();
  }

  return `data:image/jpeg;base64,${compressed.toString("base64")}`;
}
