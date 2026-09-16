"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons reference image files by URL that don't
// resolve correctly through bundlers. Rebuild the default icon from the
// package's own assets so pins render without a broken-image icon.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function FieldMap({
  fields,
  focusedFieldId,
  height = 220,
  interactive = true,
}: {
  fields: { id: string; name: string; centerLat: number | null; centerLng: number | null }[];
  focusedFieldId?: string;
  height?: number;
  interactive?: boolean;
}) {
  const plotted = fields.filter((f) => f.centerLat != null && f.centerLng != null);
  const focused = plotted.find((f) => f.id === focusedFieldId) ?? plotted[0];
  const center: [number, number] = focused
    ? [focused.centerLat as number, focused.centerLng as number]
    : [38.5449, -121.7405];

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-lg border border-zinc-200">
      <MapContainer
        center={center}
        zoom={interactive ? 14 : 13}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a> — World Imagery'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {plotted.map((f) => (
          <Marker key={f.id} position={[f.centerLat as number, f.centerLng as number]} icon={defaultIcon}>
            <Popup>{f.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
