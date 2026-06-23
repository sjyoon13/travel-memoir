import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const heicConvert = require("heic-convert");
const HEIC_EXTS = /\.hei[cf]$/i;

// 미리보기용 소형 JPEG 생성 (400px, 품질 70)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || HEIC_EXTS.test(file.name);

    let input = buffer;
    if (isHeic) {
      try {
        await sharp(buffer).metadata();
        // sharp가 읽을 수 있으면 그대로 사용
      } catch {
        const output = await heicConvert({ buffer, format: "JPEG", quality: 1 });
        input = Buffer.from(output);
      }
    }

    const preview = await sharp(input)
      .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    return new NextResponse(preview, {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch (err) {
    console.error("[preview]", err);
    return NextResponse.json({ error: "변환 실패" }, { status: 500 });
  }
}
