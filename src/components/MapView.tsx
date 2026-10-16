
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const iconoBase = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function iconoPunto(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}66, 0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export interface PuntoMapa {
  lat: number;
  lng: number;
  etiqueta: string;
  color?: string;
}

export interface ObjetivoMapa {
  lat: number;
  lng: number;
  radio: number;
  etiqueta: string;
}

const CENTRO_DEFECTO: [number, number] = [-13.0777, -76.3858];

function Ajustar({
  objetivo,
  puntos,
}: {
  objetivo?: ObjetivoMapa | null;
  puntos: PuntoMapa[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.getContainer() || !map.getSize().x || !map.getSize().y) {
      return;
    }

    const coordenadas: L.LatLngExpression[] = [];

    if (objetivo) {
      coordenadas.push([objetivo.lat, objetivo.lng]);
    }

    puntos.forEach((p) => {
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        coordenadas.push([p.lat, p.lng]);
      }
    });

    if (coordenadas.length > 1) {
      const limites = L.latLngBounds(coordenadas);
      if (limites.isValid()) {
        map.fitBounds(limites, { padding: [30, 30], maxZoom: 18 });
      }
    } else if (coordenadas.length === 1) {
      map.setView(coordenadas[0], 16);
    }
  }, [map, objetivo?.lat, objetivo?.lng, objetivo?.radio, puntos]);

  return null;
}

function Clics({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

export function MapView({
  objetivo,
  puntos = [],
  onPick,
  altura = 280,
}: {
  objetivo?: ObjetivoMapa | null;
  puntos?: PuntoMapa[];
  onPick?: (lat: number, lng: number) => void;
  altura?: number;
}) {
  const centro: [number, number] = objetivo
    ? [objetivo.lat, objetivo.lng]
    : puntos[0]
      ? [puntos[0].lat, puntos[0].lng]
      : CENTRO_DEFECTO;

  return (
    <div
      style={{ height: altura, width: '100%' }}
      className="overflow-hidden rounded-xl border border-slate-200"
    >
      <MapContainer
        center={centro}
        zoom={objetivo || puntos.length ? 16 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {objetivo && (
          <>
            <Marker
              position={[objetivo.lat, objetivo.lng]}
              icon={iconoBase}
            >
              <Popup>{objetivo.etiqueta}</Popup>
            </Marker>

            <Circle
              center={[objetivo.lat, objetivo.lng]}
              radius={objetivo.radio}
              pathOptions={{
                color: '#1E6FE0',
                fillColor: '#38BDF8',
                fillOpacity: 0.18,
              }}
            />
          </>
        )}

        {puntos.map((p, i) => (
          <Marker
            key={`${p.lat}-${p.lng}-${i}`}
            position={[p.lat, p.lng]}
            icon={iconoPunto(p.color ?? '#16a34a')}
          >
            <Popup>{p.etiqueta}</Popup>
          </Marker>
        ))}

        <Ajustar objetivo={objetivo} puntos={puntos} />

        {onPick && <Clics onPick={onPick} />}
      </MapContainer>
    </div>
  );
}

