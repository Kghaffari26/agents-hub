'use client';

import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { MapPoint, MapScale } from './mapScale';

/** Leaflet map (client only; loaded via next/dynamic with ssr:false). */
export default function MetroMap({
  points,
  scale,
  selected,
  onSelect,
  formatValue,
}: {
  points: MapPoint[];
  scale: MapScale;
  selected: string[];
  onSelect: (slug: string) => void;
  formatValue: (p: MapPoint) => string;
}) {
  const tiles = process.env.NEXT_PUBLIC_MAP_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return (
    <MapContainer
      center={[38.5, -96]}
      zoom={4}
      minZoom={3}
      maxZoom={9}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      attributionControl
    >
      <TileLayer
        url={tiles}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {[...points]
        .sort((a, b) => b.size - a.size)
        .map((p) => {
          const on = selected.includes(p.slug);
          return (
            <CircleMarker
              key={`${p.slug}-${on}`}
              center={[p.lat, p.lon]}
              radius={p.radius}
              pathOptions={{
                color: on ? '#111' : 'rgba(0,0,0,0.35)',
                weight: on ? 3 : 1,
                fillColor: scale.color(p.value),
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelect(p.slug) }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <strong>{p.name}</strong>
                <br />
                {formatValue(p)}
                <br />
                <em>{on ? 'Selected' : 'Click to compare'}</em>
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
