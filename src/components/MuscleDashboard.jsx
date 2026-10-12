import { useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { useData } from '../data';
import { plannedSets, doneSetsByMuscle, REGION_MUSCLES } from '../lib/muscleLoad';
import { muscleLabel, MUSCLE_KEYS } from '../lib/muscles';
import { now, addDays, weekStart, isoWeekKey, toISODate } from '../lib/dates';
import BodyMap, { LEVEL_COLORS } from './BodyMap';

const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const dayMonth = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

// Dashboard semanal: músculos planificados vs. realizados en la misma semana.
export default function MuscleDashboard() {
  const { profile } = useAuth();
  const { activeRoutine, weekOverride, sessions, exerciseById } = useData();
  const [offset, setOffset] = useState(0); // 0 = esta semana, -1 = anterior…
  const [side, setSide] = useState('front');
  const [selected, setSelected] = useState(null);

  const date = addDays(weekStart(now()), offset * 7);
  const isCurrent = offset === 0;
  const override = isoWeekKey(date) === isoWeekKey(now()) ? weekOverride : null;
  const planned = useMemo(() => plannedSets(activeRoutine, override, date, exerciseById), [activeRoutine, override, toISODate(date), exerciseById]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(() => doneSetsByMuscle(sessions, date), [sessions, toISODate(date)]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = MUSCLE_KEYS.map((m) => ({ m, p: planned[m] || 0, d: done[m] || 0 }))
    .filter((r) => r.p || r.d)
    .sort((a, b) => b.p - a.p || b.d - a.d);
  const sel = selected ? REGION_MUSCLES[selected] : null;
  const sex = profile?.bodySex === 'female' ? 'female' : 'male';
  const totalP = Object.values(planned).length ? rows.reduce((a, r) => a + r.p, 0) : 0;

  return (
    <section className="dash">
      <div className="week-nav">
        <button className="icon-btn" onClick={() => { setOffset((o) => o - 1); setSelected(null); }} aria-label="Semana anterior">‹</button>
        <div className="week-label">
          <strong>{isCurrent ? 'Esta semana' : offset === -1 ? 'Semana pasada' : `Semana del ${dayMonth(date)}`}</strong>
          <span className="muted small">{dayMonth(date)} – {dayMonth(addDays(date, 6))}</span>
        </div>
        <button className="icon-btn" disabled={isCurrent} onClick={() => { setOffset((o) => o + 1); setSelected(null); }} aria-label="Semana siguiente">›</button>
      </div>

      <div className="segmented small-seg">
        <button className={side === 'front' ? 'on' : ''} onClick={() => setSide('front')}>Frente</button>
        <button className={side === 'back' ? 'on' : ''} onClick={() => setSide('back')}>Espalda</button>
      </div>

      <div className="bodies">
        <figure>
          <BodyMap sex={sex} side={side} values={planned} selected={selected} onSelect={setSelected} label="Músculos planificados" />
          <figcaption>Planificado</figcaption>
        </figure>
        <figure>
          <BodyMap sex={sex} side={side} values={done} selected={selected} onSelect={setSelected} label="Músculos trabajados" />
          <figcaption>Realizado</figcaption>
        </figure>
      </div>

      <p className="body-tip">
        {sel
          ? sel.map((m) => `${muscleLabel(m)}: ${fmt(planned[m] || 0)} plan · ${fmt(done[m] || 0)} hechas`).join(' — ')
          : 'Toca un músculo para ver sus series.'}
      </p>

      <div className="legend" aria-label="Leyenda: series semanales por músculo">
        {['0', '1–4', '5–9', '10–20', '>20'].map((t, i) => (
          <span key={t} className="legend-item"><i style={{ background: LEVEL_COLORS[i] }} />{t}</span>
        ))}
      </div>
      <p className="muted small center">
        Series por semana · principal = 1, secundario = 0,5. Antebrazo, gemelo, abdomen, cuello y aductores/abductores usan umbrales menores (1–2 · 3–5 · 6–10 · &gt;10).
      </p>

      {!activeRoutine && <p className="muted small">Sin rutina activa: no hay plan que mostrar.</p>}
      {!isCurrent && activeRoutine && <p className="muted small">El plan de semanas pasadas se calcula con la rutina actual.</p>}
      {activeRoutine?.mode === 'sequential' && <p className="muted small">Rutina secuencial: el plan cuenta un ciclo completo de sesiones.</p>}

      {rows.length > 0 && (
        <table className="hist muscle-table">
          <thead><tr><th>Músculo</th><th>Plan</th><th>Hecho</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.p ? Math.min(100, (r.d / r.p) * 100) : r.d ? 100 : 0;
              return (
                <tr key={r.m}>
                  <td>{muscleLabel(r.m)}</td>
                  <td>{fmt(r.p)}</td>
                  <td>{fmt(r.d)}</td>
                  <td className="bar-cell"><span className="mini-bar"><span style={{ width: `${pct}%` }} /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {totalP === 0 && rows.length === 0 && <p className="muted small">Nada planificado ni hecho esta semana.</p>}
    </section>
  );
}

