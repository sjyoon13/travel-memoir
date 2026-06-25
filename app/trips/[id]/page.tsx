"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const TripMap = dynamic(() => import("@/app/components/TripMap"), { ssr: false });

const MEMOIR_LOADING_MSGS = [
  "추억 만드는 중...",
  "사진들을 돌아보는 중...",
  "이야기를 엮는 중...",
  "마무리하는 중...",
];

const UPLOAD_LOADING_MSGS = [
  "추억 덧붙이는 중...",
  "사진 업로드하는 중...",
  "위치 정보 읽는 중...",
  "앨범에 추가하는 중...",
];

const IMAGE_EXTS = /\.(jpe?g|jfif|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;
const HEIC_EXTS = /\.hei[cf]$/i;

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
    if (thumbnail) return URL.createObjectURL(new Blob([new Uint8Array(thumbnail)], { type: "image/jpeg" }));
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

function sortByTime(previews: PreviewFile[]): PreviewFile[] {
  return [...previews].sort((a, b) => {
    if (!a.takenAt && !b.takenAt) return 0;
    if (!a.takenAt) return 1;
    if (!b.takenAt) return -1;
    return a.takenAt.getTime() - b.takenAt.getTime();
  });
}

interface PreviewFile {
  file: File;
  previewUrl: string | null;
  takenAt: Date | null;
}

interface Photo {
  id: number;
  url: string;
  taken_at: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
}

interface Trip {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  summary: string | null;
}

type Tab = "photos" | "map";

export default function TripPage() {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [uploadMsgIdx, setUploadMsgIdx] = useState(0);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [tab, setTab] = useState<Tab>("photos");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // 사진 추가 모달
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addPreviews, setAddPreviews] = useState<PreviewFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pageDragging, setPageDragging] = useState(false);
  const [modalDragging, setModalDragging] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((r) => r.json())
      .then(({ trip, photos }) => { setTrip(trip); setPhotos(photos); });
  }, [id]);

  // 회고록 생성 중 메시지 순환
  useEffect(() => {
    if (!generating) { setLoadingMsgIdx(0); return; }
    const timer = setInterval(
      () => setLoadingMsgIdx((i) => (i + 1) % MEMOIR_LOADING_MSGS.length),
      2500,
    );
    return () => clearInterval(timer);
  }, [generating]);

  // 사진 업로드 중 메시지 순환
  useEffect(() => {
    if (!uploading) { setUploadMsgIdx(0); return; }
    const timer = setInterval(
      () => setUploadMsgIdx((i) => (i + 1) % UPLOAD_LOADING_MSGS.length),
      2200,
    );
    return () => clearInterval(timer);
  }, [uploading]);

  // 파일 → 미리보기 처리 후 기존 목록에 합산·정렬
  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || IMAGE_EXTS.test(f.name)
    );
    if (images.length === 0) return;

    const newPreviews = await Promise.all(
      images.map(async (file) => {
        const [previewUrl, takenAt] = await Promise.all([getPreviewUrl(file), getExifTime(file)]);
        return { file, previewUrl, takenAt };
      })
    );
    setAddPreviews((prev) => sortByTime([...prev, ...newPreviews]));
  }, []);

  const openAddModal = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setAddPreviews((prev) => {
      prev.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
      return [];
    });
    setAddModalOpen(false);
    if (modalFileInputRef.current) modalFileInputRef.current.value = "";
  }, []);

  const removePreview = (i: number) => {
    setAddPreviews((prev) => {
      if (prev[i].previewUrl) URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const confirmAddPhotos = async () => {
    if (addPreviews.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    addPreviews.forEach(({ file }) => formData.append("photos", file));
    const res = await fetch(`/api/trips/${id}/photos`, { method: "POST", body: formData });
    if (res.ok) {
      const updated = await fetch(`/api/trips/${id}`).then((r) => r.json());
      setPhotos(updated.photos);
      setTrip(updated.trip);
      closeAddModal();
    } else if (res.status === 429) {
      const data = await res.json();
      alert(data.error);
    } else {
      alert("업로드 실패");
    }
    setUploading(false);
  };

  // 페이지 드래그 (모달 닫혀있을 때만)
  const onPageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!addModalOpen) setPageDragging(true);
  }, [addModalOpen]);

  const onPageDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPageDragging(false);
  }, []);

  const onPageDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setPageDragging(false);
    if (addModalOpen) return;
    setAddModalOpen(true);
    await addFiles(e.dataTransfer.files);
  }, [addModalOpen, addFiles]);

  // 모달 내 드래그
  const onModalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragging(true);
  }, []);

  const onModalDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setModalDragging(false);
  }, []);

  const onModalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragging(false);
    await addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleSetCover = async (photoUrl: string) => {
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_url: photoUrl }),
    });
    if (res.ok) setTrip((prev) => prev ? { ...prev, cover_url: photoUrl } : prev);
  };

  const handleGenerateSummary = async () => {
    setGenerating(true);
    const res = await fetch(`/api/trips/${id}/summary`, { method: "POST" });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      setTrip((prev) => prev ? { ...prev, summary: data.summary } : prev);
    } else if (data.error) {
      alert(data.error); // 서버에서 내려온 한국어 안내 메시지 (429, 503 등)
    } else {
      alert("회고록 생성에 실패했습니다.");
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === trip?.name) { setEditing(false); return; }
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) setTrip((prev) => prev ? { ...prev, name: editName.trim() } : prev);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("이 여행을 삭제할까요? 사진 기록도 모두 사라집니다.")) return;
    await fetch(`/api/trips/${id}`, { method: "DELETE" });
    router.push("/");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // 하루짜리 여행이면 날짜 하나만 표시
  const formatDateRange = (start: string, end: string) => {
    const s = formatDate(start);
    const e = formatDate(end);
    return s === e ? s : `${s} – ${e}`;
  };

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        불러오는 중...
      </div>
    );
  }

  return (
    <main
      className="min-h-screen px-6 py-10 relative"
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      {/* 회고록 생성 로딩 오버레이 */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(10, 20, 60, 0.5)" }}>
          <div className="bg-white/90 backdrop-blur-md rounded-3xl px-10 py-10 text-center shadow-2xl border border-white/60 max-w-xs w-full mx-4">
            {/* 떠다니는 메인 이모지 */}
            <div className="text-6xl mb-4 animate-float select-none">✨</div>

            {/* 보조 이모지 3개 */}
            <div className="flex justify-center gap-5 text-2xl mb-6 select-none">
              <span className="animate-twinkle" style={{ animationDelay: "0ms" }}>📸</span>
              <span className="animate-twinkle" style={{ animationDelay: "550ms" }}>✈️</span>
              <span className="animate-twinkle" style={{ animationDelay: "1100ms" }}>🌏</span>
            </div>

            {/* 순환 메시지 */}
            <p className="text-stone-800 font-bold text-lg mb-1">
              {MEMOIR_LOADING_MSGS[loadingMsgIdx]}
            </p>
            <p className="text-stone-500 text-sm mb-6">AI가 여행 회고록을 작성하고 있어요</p>

            {/* 점 세 개 */}
            <div className="flex justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-shimmer-dot" style={{ animationDelay: "0ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-shimmer-dot" style={{ animationDelay: "250ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-shimmer-dot" style={{ animationDelay: "500ms" }} />
            </div>
          </div>
        </div>
      )}

      {/* 페이지 드래그 오버레이 (모달 닫혔을 때만) */}
      {pageDragging && (
        <div className="fixed inset-0 z-40 bg-stone-800/30 border-4 border-dashed border-stone-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-lg">
            <p className="text-4xl mb-3">📸</p>
            <p className="text-stone-700 font-semibold text-lg">사진을 여기에 놓으세요</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">

        {/* 뒤로가기 */}
        <button
          onClick={() => router.push("/")}
          className="text-stone-500 hover:text-stone-700 mb-6 flex items-center gap-1 text-sm"
        >
          ← 목록으로
        </button>

        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-8 gap-3 sm:gap-4">
          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="text-2xl sm:text-3xl font-bold text-stone-800 bg-white border border-stone-300 rounded-lg px-3 py-1 w-full focus:outline-none focus:border-stone-500"
                />
                <button onClick={handleSaveName} className="text-sm bg-stone-800 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 transition shrink-0">저장</button>
                <button onClick={() => setEditing(false)} className="text-sm border border-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition shrink-0">취소</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 break-words">{trip.name}</h1>
                <button
                  onClick={() => { setEditName(trip.name); setEditing(true); }}
                  title="이름 수정"
                  className="opacity-0 group-hover:opacity-100 transition text-stone-400 hover:text-stone-600 text-lg shrink-0"
                >
                  ✏️
                </button>
              </div>
            )}
            <p className="text-stone-500 mt-1 text-sm sm:text-base break-words">
              📍 {trip.location}
            </p>
            <p className="text-stone-400 text-xs sm:text-sm mt-0.5">
              {formatDateRange(trip.start_date, trip.end_date)}
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
            <button
              onClick={openAddModal}
              className="border border-stone-300 text-stone-600 px-3 py-2 rounded-xl hover:bg-stone-100 transition text-sm whitespace-nowrap"
            >
              + 사진 추가
            </button>
            <button
              onClick={handleGenerateSummary}
              disabled={generating}
              className="bg-stone-800 text-white px-4 py-2 rounded-xl hover:bg-stone-700 transition disabled:opacity-40 text-sm whitespace-nowrap"
            >
              {generating ? "생성 중..." : trip.summary ? "회고록 재생성" : "✨ AI 회고록 생성"}
            </button>
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-2 rounded-xl transition text-sm whitespace-nowrap"
            >
              삭제
            </button>
          </div>
        </div>

        {/* AI 요약 */}
        {trip.summary && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-md border border-white/60">
            <h2 className="font-semibold text-stone-700 mb-3">✈️ 여행 회고록</h2>
            <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{trip.summary}</p>
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 mb-4 bg-stone-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("photos")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === "photos" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
          >
            📷 사진 ({photos.length})
          </button>
          <button
            onClick={() => setTab("map")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === "map" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
          >
            🗺️ 지도
          </button>
        </div>

        {/* 사진 그리드 */}
        {tab === "photos" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo) => {
              const isCover = trip.cover_url === photo.url;
              return (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-stone-200 cursor-pointer group hover:opacity-90 transition"
                  onClick={() => setSelected(photo)}
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  {/* 커버 선택 버튼 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetCover(photo.url); }}
                    title={isCover ? "현재 커버 사진" : "커버로 설정"}
                    className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition
                      ${isCover
                        ? "bg-white border-white shadow-md"
                        : "bg-black/30 border-white/70 opacity-0 group-hover:opacity-100"
                      }`}
                  >
                    {isCover && (
                      <div className="w-3 h-3 rounded-full bg-stone-800" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 지도 */}
        {tab === "map" && <TripMap photos={photos} />}

        {/* 사진 상세 모달 */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-6"
            onClick={() => setSelected(null)}
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <img src={selected.url} alt="" className="w-full max-h-[55vh] sm:max-h-96 object-contain bg-stone-900" />
              <div className="p-4">
                {selected.taken_at && <p className="text-stone-500 text-sm">{formatDate(selected.taken_at)}</p>}
                {selected.location && <p className="text-stone-600 text-sm mt-1">📍 {selected.location}</p>}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selected.tags.map((tag, i) => (
                      <span key={i} className="bg-stone-100 text-stone-600 text-xs px-2 py-1 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
                <button onClick={() => setSelected(null)} className="mt-4 w-full py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">닫기</button>
              </div>
            </div>
          </div>
        )}

        {/* 사진 추가 모달 */}
        {addModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div
              className="relative bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-white/60"
              onClick={(e) => e.stopPropagation()}
              onDragOver={onModalDragOver}
              onDragLeave={onModalDragLeave}
              onDrop={onModalDrop}
            >
              {/* 업로드 중 로딩 오버레이 */}
              {uploading && (
                <div className="absolute inset-0 z-10 bg-white/85 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="text-center px-8 py-6">
                    <div className="text-5xl mb-4 animate-float select-none">📸</div>
                    <div className="flex justify-center gap-5 text-2xl mb-5 select-none">
                      <span className="animate-twinkle" style={{ animationDelay: "0ms" }}>🖼️</span>
                      <span className="animate-twinkle" style={{ animationDelay: "550ms" }}>✨</span>
                      <span className="animate-twinkle" style={{ animationDelay: "1100ms" }}>🗺️</span>
                    </div>
                    <p className="text-stone-800 font-bold text-lg mb-1">
                      {UPLOAD_LOADING_MSGS[uploadMsgIdx]}
                    </p>
                    <p className="text-stone-500 text-sm mb-5">잠시만 기다려주세요</p>
                    <div className="flex justify-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-shimmer-dot" style={{ animationDelay: "0ms" }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-shimmer-dot" style={{ animationDelay: "250ms" }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-shimmer-dot" style={{ animationDelay: "500ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* 모달 헤더 */}
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-stone-800">사진 추가</h2>
                  {addPreviews.length > 0 && (
                    <p className="text-stone-400 text-sm mt-0.5">{addPreviews.length}장 선택됨 · 사진 시간 순 정렬</p>
                  )}
                </div>
                <button onClick={closeAddModal} disabled={uploading} className="text-stone-400 hover:text-stone-600 transition text-xl leading-none disabled:opacity-40">×</button>
              </div>

              {/* 모달 본문 */}
              <div className="overflow-y-auto flex-1 p-6">
                {/* 드래그존 / 클릭 선택 */}
                <div
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition mb-4
                    ${modalDragging ? "border-stone-600 bg-stone-100" : "border-stone-300 hover:border-stone-400 hover:bg-stone-50"}`}
                >
                  <p className="text-3xl mb-2">📸</p>
                  <p className="text-stone-600 font-medium text-sm">클릭하거나 사진을 끌어다 놓으세요</p>
                  <p className="text-stone-400 text-xs mt-1">JPG, JFIF, PNG, HEIC 지원</p>
                </div>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); if (modalFileInputRef.current) modalFileInputRef.current.value = ""; }}
                />

                {/* 미리보기 그리드 */}
                {addPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {addPreviews.map(({ previewUrl }, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-stone-200">
                        {previewUrl
                          ? <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-100">📷</div>
                        }
                        <button
                          onClick={() => removePreview(i)}
                          disabled={uploading}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center disabled:opacity-40"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="px-6 py-4 border-t border-stone-100 flex gap-3 shrink-0">
                <button onClick={closeAddModal} disabled={uploading} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 transition disabled:opacity-40">취소</button>
                <button
                  onClick={confirmAddPhotos}
                  disabled={addPreviews.length === 0 || uploading}
                  className="flex-1 py-3 rounded-xl bg-stone-800 text-white hover:bg-stone-700 transition disabled:opacity-40"
                >
                  {uploading ? "업로드 중..." : addPreviews.length > 0 ? `${addPreviews.length}장 추가` : "사진을 선택하세요"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
