
export interface Posicion {
  lat: number;
  lng: number;
  precision: number;
}

/** Obtiene la ubicación GPS del dispositivo. */
export function obtenerPosicion(): Promise<Posicion> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no permite obtener la ubicación.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: p.coords.accuracy,
        }),
      (e) => {
        const msg =
          e.code === e.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en el navegador.'
            : e.code === e.POSITION_UNAVAILABLE
              ? 'No se pudo determinar tu ubicación. Activa el GPS.'
              : 'Se agotó el tiempo para obtener tu ubicación.';

        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/** Calcula la distancia entre dos puntos en metros. */
export function distanciaM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;

  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lng2 - lng1) / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Busca una dirección y devuelve sus coordenadas. */
export async function buscarDireccion(
  q: string,
): Promise<{ lat: number; lng: number; nombre: string } | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pe&q=${encodeURIComponent(q)}`;

  const r = await fetch(url, {
    headers: { 'Accept-Language': 'es' },
  });

  if (!r.ok) {
    throw new Error('No se pudo buscar la dirección. Inténtalo nuevamente.');
  }

  const data = (await r.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];

  if (!data.length) return null;

  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    nombre: data[0].display_name,
  };
}

/** Convierte las coordenadas del mapa en una dirección. */
export async function obtenerDireccion(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

  const r = await fetch(url, {
    headers: { 'Accept-Language': 'es' },
  });

  if (!r.ok) {
    throw new Error('No se pudo obtener la dirección de ese punto.');
  }

  const data = (await r.json()) as {
    display_name?: string;
    error?: string;
  };

  if (data.error || !data.display_name) return null;

  return data.display_name;
}

