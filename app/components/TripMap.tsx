"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

interface Photo {
  id: number;
  url: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  taken_at: string | null;
}

export default function TripMap({ photos }: { photos: Photo[] }) {
  const geoPhotos = photos.filter(
    (p): p is Photo & { lat: number; lng: number } => p.lat != null && p.lng != null
  );

  if (geoPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-stone-100 rounded-2xl text-stone-400 gap-2">
        <span className="text-3xl">📍</span>
        <p>GPS 정보가 있는 사진이 없습니다.</p>
      </div>
    );
  }

  const avgLat = geoPhotos.reduce((s, p) => s + p.lat, 0) / geoPhotos.length;
  const avgLng = geoPhotos.reduce((s, p) => s + p.lng, 0) / geoPhotos.length;

  return (
    <MapContainer
      center={[avgLat, avgLng]}
      zoom={13}
      style={{ height: 500, borderRadius: "1rem", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geoPhotos.map((photo) => (
        <CircleMarker
          key={photo.id}
          center={[photo.lat, photo.lng]}
          radius={10}
          pathOptions={{ color: "#44403c", fillColor: "#78716c", fillOpacity: 0.85, weight: 2 }}
        >
          <Popup maxWidth={180}>
            <img
              src={photo.url}
              alt=""
              style={{ width: "100%", borderRadius: 6, marginBottom: 4, display: "block" }}
            />
            {photo.location && (
              <p style={{ fontSize: 12, margin: "0 0 2px" }}>📍 {photo.location}</p>
            )}
            {photo.taken_at && (
              <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
                {new Date(photo.taken_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
              </p>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
