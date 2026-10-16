import type { TareaPlan } from '../lib/schedule';
import { fmtDuracion, horaPeru } from '../lib/time';

const COLORES: Record<string, string> = {
  pendiente: 'bg-sky-300',
  en_progreso: 'bg-brand',
  completada: 'bg-emerald-500',
};

/** Línea de tiempo tipo Gantt (hora de Perú). Las barras en paralelo se muestran en filas distintas. */
export function Gantt({ planes, nombreResp }: { planes: TareaPlan[]; nombreResp: (id: string | null) => string }) {
  if (!planes.length) return null;
  const ahora = new Date();
  const HORA = 3600_000;
  let min = Math.min(...planes.map((p) => Math.min(p.inicio.getTime(), p.inicioReal?.getTime() ?? Infinity)));
  let max = Math.max(...planes.map((p) => Math.max(p.fin.getTime(), p.finReal?.getTime() ?? 0)));
  if (ahora.getTime() > min && ahora.getTime() < max + 6 * HORA) max = Math.max(max, ahora.getTime());
  min = Math.floor(min / HORA) * HORA;
  max = Math.ceil(max / HORA) * HORA;
  const total = max - min;
  const pct = (t: number) => ((t - min) / total) * 100;
  const horas: number[] = [];
  for (let t = min; t <= max; t += HORA) horas.push(t);
  const paso = horas.length > 14 ? 2 : 1;
  const ahoraVisible = ahora.getTime() >= min && ahora.getTime() <= max;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div style={{ minWidth: 760 }}>
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="w-52 shrink-0 px-3 py-2 font-semibold">Actividad</div>
          <div className="relative h-8 flex-1">
            {horas.map((t, i) => (i % paso === 0 ? (
              <span key={t} className="absolute top-2 -translate-x-1/2" style={{ left: `${pct(t)}%` }}>{horaPeru(new Date(t))}</span>
            ) : null))}
          </div>
        </div>
        <div className="relative">
        {planes.map((p) => {
          const color = p.retrasada ? 'bg-red-500' : COLORES[p.tarea.estado];
          return (
            <div key={p.tarea.id} className="flex border-b border-slate-100 last:border-0">
              <div className="w-52 shrink-0 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800" title={p.tarea.nombre}>{p.tarea.nombre}</p>
                <p className="truncate text-xs text-slate-500">{nombreResp(p.tarea.responsable_id)}</p>
              </div>
              <div className="relative flex-1 py-2">
                {horas.map((t, i) => (i % paso === 0 ? <span key={t} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${pct(t)}%` }} /> : null))}
                <div
                  className={`absolute top-2 flex h-5 items-center overflow-hidden rounded px-1 text-[10px] font-semibold text-white ${color}`}
                  style={{ left: `${pct(p.inicio.getTime())}%`, width: `${Math.max(pct(p.fin.getTime()) - pct(p.inicio.getTime()), 0.8)}%` }}
                  title={`${horaPeru(p.inicio)} – ${horaPeru(p.fin)} (${fmtDuracion(p.tarea.duracion_min)})`}
                >
                  {horaPeru(p.inicio)}–{horaPeru(p.fin)}
                </div>
                {p.inicioReal && (
                  <div
                    className="absolute top-[30px] h-1.5 rounded bg-navy-800"
                    style={{ left: `${pct(p.inicioReal.getTime())}%`, width: `${Math.max(pct((p.finReal ?? ahora).getTime()) - pct(p.inicioReal.getTime()), 0.5)}%` }}
                    title="Tiempo real"
                  />
                )}
              </div>
            </div>
          );
        })}
          {ahoraVisible && (
            <div className="pointer-events-none absolute inset-y-0 left-52 right-0">
              <div className="absolute inset-y-0 border-l-2 border-red-500" style={{ left: `${pct(ahora.getTime())}%` }} title="Ahora" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
        <Leyenda c="bg-sky-300" t="Pendiente" /><Leyenda c="bg-brand" t="En progreso" /><Leyenda c="bg-emerald-500" t="Completada" />
        <Leyenda c="bg-red-500" t="Retrasada" /><Leyenda c="bg-navy-800" t="Tiempo real" />
      </div>
    </div>
  );
}

function Leyenda({ c, t }: { c: string; t: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-4 rounded ${c}`} />{t}</span>;
}
