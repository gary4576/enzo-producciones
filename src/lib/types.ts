export type Rol = 'administrador' | 'supervisor' | 'trabajador';

export interface Profile {
  id: string;
  nombres: string;
  dni: string;
  email: string;
  celular: string;
  cargo: string;
  especialidad: string | null;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Config {
  id: number;
  hora_entrada: string;
  hora_salida: string;
  tolerancia_min: number;
  sede_lat: number | null;
  sede_lng: number | null;
  sede_radio_m: number;
}

export type EstadoEvento = 'programado' | 'en_montaje' | 'en_curso' | 'finalizado' | 'cancelado';

export interface Evento {
  id: string;
  nombre: string;
  cliente: string;
  fecha: string; // yyyy-mm-dd
  hora_citacion: string; // HH:mm:ss
  hora_inicio: string;
  hora_fin: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  radio_m: number;
  estado: EstadoEvento;
  notas: string | null;
  created_at: string;
}

export interface MiembroEquipo {
  event_id: string;
  worker_id: string;
  nombres: string;
  cargo: string;
  especialidad: string | null;
}

export interface Equipo {
  id: string;
  event_id: string;
  nombre: string;
  cantidad: number;
}

export type EstadoAsistencia = 'puntual' | 'tardanza' | 'falta_justificada' | 'falta_injustificada';

export interface Asistencia {
  id: string;
  worker_id: string;
  event_id: string | null;
  fecha: string;
  hora_programada: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_tardanza: number;
  estado: EstadoAsistencia;
  entrada_lat: number | null;
  entrada_lng: number | null;
  entrada_precision_m: number | null;
  entrada_distancia_m: number | null;
  entrada_dentro_area: boolean | null;
  salida_lat: number | null;
  salida_lng: number | null;
  salida_distancia_m: number | null;
  salida_dentro_area: boolean | null;
  observaciones: string | null;
  justificacion: string | null;
  profiles?: { nombres: string; dni: string } | null;
  events?: { nombre: string; lat: number | null; lng: number | null; radio_m: number } | null;
}

export type Categoria =
  | 'transporte' | 'pantallas_led' | 'sonido' | 'iluminacion' | 'cableado' | 'consolas' | 'pruebas' | 'otro';
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada';

export interface Tarea {
  id: string;
  event_id: string;
  nombre: string;
  categoria: Categoria;
  responsable_id: string | null;
  depende_de: string[];
  inicio_plan: string | null;
  duracion_min: number;
  estado: EstadoTarea;
  inicio_real: string | null;
  fin_real: string | null;
  notas: string | null;
  events?: { nombre: string; fecha: string; hora_citacion: string } | null;
}

export const CATEGORIAS: Record<Categoria, string> = {
  transporte: 'Transporte',
  pantallas_led: 'Pantallas LED',
  sonido: 'Sonido / parlantes',
  iluminacion: 'Iluminación',
  cableado: 'Cableado',
  consolas: 'Consolas',
  pruebas: 'Pruebas técnicas',
  otro: 'Otra',
};

export const ESTADOS_EVENTO: Record<EstadoEvento, string> = {
  programado: 'Programado',
  en_montaje: 'En montaje',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const ESTADOS_ASISTENCIA: Record<EstadoAsistencia, string> = {
  puntual: 'Puntual',
  tardanza: 'Tardanza',
  falta_justificada: 'Falta justificada',
  falta_injustificada: 'Falta injustificada',
};

export const ROLES: Record<Rol, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  trabajador: 'Trabajador',
};
