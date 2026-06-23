"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const IMAGE_EXTS = /\.(jpe?g|jfif|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;
const HEIC_EXTS = /\.hei[cf]$/i;

const UPLOAD_MSGS = [
  "앨범 만드는 중...",
  "사진 날짜 분류하는 중...",
  "위치 정보 읽는 중...",
  "거의 다 됐어요...",
];

function isHeic(file: File) {
  return file.type === "image/heic" || file.type === "image/heif" || HEIC_EXTS.test(file.name);
}

async function getExifTime(file: File): Promise<Date | null> {
  try {
    const exifr = await import("exifr");
    const data = await exifr.parse(file, ["DateTimeOriginal"]);
    return data?.DateTimeOriginal instanceof Date ? data.DateTimeOriginal : null;
  } catch {
    return null;
  }
}

async function getPreviewUrl(file: File): Promise<string | null> {
  if (!isHeic(file)) return URL.createObjectURL(file);

  try {
    const exifr = await import("exifr");
    const thumbnail = await exifr.thumbnail(file);
    if (thumbnail) return URL.createObjectURL(new Blob([thumbnail], { type: "image/jpeg" }));
  } catch { /* 썸네일 없으면 폴백 */ }

  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/preview", { method: "POST", body: formData });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

interface PreviewFile {
  file: File;
  previewUrl: string | null;
  takenAt: Date | null;
}

export default function UploadPage() {
  const router = useRouter();
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [previewing, setPreviewing] = useState(false); // 미리보기 생성 중
  const [uploading, setUploading] = useState(false);
  const [uploadMsgIdx, setUploadMsgIdx] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => previews.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
  }, [previews]);

  // 업로드 중 메시지 순환
  useEffect(() => {
    if (!uploading) { setUploadMsgIdx(0); return; }
    const timer = setInterval(
      () => setUploadMsgIdx((i) => (i + 1) % UPLOAD_MSGS.length),
      2200,
    );
    return () => clearInterval(timer);
  }, [uploading]);

  const addFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles) return;
    const images = Array.from(newFiles).filter(
      (f) => f.type.startsWith("image/") || IMAGE_EXTS.test(f.name)
    );
    if (images.length === 0) return;

    setPreviewing(true);
    try {
      const newPreviews = await Promise.all(
        images.map(async (file) => {
          const [previewUrl, takenAt] = await Promise.all([getPreviewUrl(file), getExifTime(file)]);
          return { file, previewUrl, takenAt };
        })
      );
      setPreviews((prev) => {
        const combined = [...prev, ...newPreviews];
        return combined.sort((a, b) => {
          if (!a.takenAt && !b.takenAt) return 0;
          if (!a.takenAt) return 1;
          if (!b.takenAt) return -1;
          return a.takenAt.getTime() - b.takenAt.getTime();
        });
      });
    } catch (err) {
      console.error("파일 미리보기 생성 실패:", err);
      alert("일부 파일을 불러오는 데 실패했습니다.");
    } finally {
      setPreviewing(false);
    }
  }, []);

  const removeFile = (i: number) => {
    setPreviews((prev) => {
      if (prev[i].previewUrl) URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleSubmit = async () => {
    if (previews.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const { file } of previews) formData.append("photos", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        router.push("/");
      } else if (res.status === 429) {
        alert(data.error);
      } else {
        alert("업로드 실패: " + (data.detail ?? data.error));
      }
    } catch (err) {
      console.error("업로드 오류:", err);
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-10">

      {/* 업로드 중 전체화면 오버레이 */}
      {uploading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(10, 20, 60, 0.5)" }}
        >
          <div className="bg-white/90 backdrop-blur-md rounded-3xl px-10 py-10 text-center shadow-2xl border border-white/60 max-w-xs w-full mx-4">
            <div className="text-6xl mb-4 animate-float select-none">✈️</div>
            <div className="flex justify-center gap-5 text-2xl mb-6 select-none">
              <span className="animate-twinkle" style={{ animationDelay: "0ms" }}>📸</span>
              <span className="animate-twinkle" style={{ animationDelay: "550ms" }}>✨</span>
              <span className="animate-twinkle" style={{ animationDelay: "1100ms" }}>🗺️</span>
            </div>
            <p className="text-stone-800 font-bold text-lg mb-1">{UPLOAD_MSGS[uploadMsgIdx]}</p>
            <p className="text-stone-500 text-sm mb-6">잠시만 기다려주세요</p>
            <div className="flex justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-shimmer-dot" style={{ animationDelay: "0ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-shimmer-dot" style={{ animationDelay: "250ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-shimmer-dot" style={{ animationDelay: "500ms" }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">사진 업로드</h1>
        <p className="text-stone-500 mb-8">
          여행 사진을 올리면 날짜 기준으로 자동으로 앨범을 묶어드립니다.
        </p>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer relative
            ${dragging ? "border-blue-500 bg-sky-50/80" : "border-stone-300/70 bg-white/70 backdrop-blur-sm"}`}
          onClick={() => !previewing && document.getElementById("file-input")?.click()}
        >
          {/* 미리보기 생성 중 인라인 로딩 */}
          {previewing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="text-4xl animate-float select-none">🖼️</div>
              <p className="text-stone-600 font-medium">사진 불러오는 중...</p>
              <div className="flex gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-shimmer-dot" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-shimmer-dot" style={{ animationDelay: "200ms" }} />
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-shimmer-dot" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          ) : (
            <>
              <p className="text-4xl mb-3">📸</p>
              <p className="text-stone-600 font-medium">클릭하거나 사진을 끌어다 놓으세요</p>
              <p className="text-stone-400 text-sm mt-1">JPG, JFIF, PNG, HEIC 지원</p>
            </>
          )}
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* 선택된 파일 목록 */}
        {previews.length > 0 && (
          <div className="mt-6">
            <p className="text-stone-600 font-medium mb-3">{previews.length}장 선택됨</p>
            <div className="grid grid-cols-4 gap-2">
              {previews.map(({ previewUrl }, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-stone-200">
                  {previewUrl
                    ? <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-100">📷</div>
                  }
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => router.push("/")}
            disabled={uploading}
            className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 transition disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={previews.length === 0 || uploading || previewing}
            className="flex-1 py-3 rounded-xl bg-blue-700/90 text-white hover:bg-blue-800 transition disabled:opacity-40"
          >
            {previews.length > 0 ? `${previews.length}장 업로드` : "사진을 선택하세요"}
          </button>
        </div>
      </div>
    </main>
  );
}
