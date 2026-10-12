import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { saveBodyMetric, deleteBodyMetric } from '../lib/db';
import { METHODS, METRICS, combosFor, series } from '../lib/body';
import { toISODate, now, parseISODate } from '../lib/dates';
import { Header, Stepper, Empty } from '../components/ui';
import LineChart from '../components/LineChart';

const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const shortDate = (iso) => parseISODate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const unitLabel = (u) => (u === 'pct' ? '%' : 'kg');

// Vista de composición corporal (dentro de la pestaña Progreso).
export function BodyView() {
  const navigate = useNavigate();
  const { bodyMetrics } = useData();
  const [metric, setMetric] = useState('weight');
  const combos = useMemo(() => combosFor(bodyMetrics, metric), [bodyMetrics, metric]);
  const [comboKey, setComboKey] = useState(null);
  const combo = combos.find((c) => c.key === comboKey) || combos[0];
  const data = useMemo(() => (combo ? series(bodyMetrics, metric, combo) : []), [bodyMetrics, metric, combo]);
  const unit = metric === 'weight' ? 'kg' : unitLabel(combo?.unit);
  const last = data.at(-1);
  // Cambio en ~30 días usando la media (menos ruido que el dato diario)
  const ref30 = last ? [...data].reverse().find((p) => parseISODate(last.date) - parseISODate(p.date) >= 28 * 86400000) : null;

  return (
    <section>
      <button className="btn primary wide" onClick={() => navigate('/cuerpo/nuevo')}>+ Registrar medición</button>
      <div className="segmented four mt8">
        {Object.entries(METRICS).map(([k, m]) => (
          <button key={k} className={metric === k ? 'on' : ''} onClick={() => { setMetric(k); setComboKey(null); }}>{m.short}</button>
        ))}
      </div>

      {combos.length > 1 && (
        <div className="muscle-grid mt8">
          {combos.map((c) => (
            <button key={c.key} className={combo?.key === c.key ? 'chip-btn primary' : 'chip-btn'} onClick={() => setComboKey(c.key)}>
              {METHODS[c.method] || 'Otro'} · {unitLabel(c.unit)}
            </button>
          ))}
        </div>
      )}
      {combos.length > 1 && <p className="muted small">Solo se comparan mediciones del mismo método y unidad.</p>}

      {!data.length ? (
        <Empty title={`Sin registros de ${METRICS[metric].label.toLowerCase()}`} />
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Media 7 días</span>
              <span className="stat-value">{fmt(last.avg)} {unit}</span>
              <span className="stat-sub">último dato {fmt(last.value)} · {shortDate(last.date)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Cambio ~30 días</span>
              <span className="stat-value">{ref30 ? `${last.avg - ref30.avg > 0 ? '+' : ''}${fmt(last.avg - ref30.avg)}` : '—'}</span>
              <span className="stat-sub">{ref30 ? `desde ${shortDate(ref30.date)}, en ${unit}` : 'faltan datos de hace un mes'}</span>
            </div>
          </div>
          <LineChart
            points={data.map((p) => ({ x: shortDate(p.date), y: p.value, avg: p.avg, tip: shortDate(p.date) }))}
            unit={unit}
            ariaLabel={`Evolución de ${METRICS[metric].label}`}
          />
          {metric !== 'weight' && combo?.method === 'bia' && (
            <p className="muted small">La bioimpedancia varía 1–3 puntos según la hidratación: fíjate en la media, no en el dato del día.</p>
          )}
        </>
      )}

      {bodyMetrics.length > 0 && (
        <>
          <p className="filter-label mt8">Registros</p>
          <ul className="list">
            {bodyMetrics.slice(0, 30).map((e) => (
              <li key={e.id}>
                <button className="row-btn" onClick={() => navigate(`/cuerpo/${e.id}`)}>
                  <span className="row-title">{shortDate(e.date)}{e.weightKg ? ` · ${fmt(e.weightKg)} kg` : ''}</span>
                  <span className="row-sub">
                    {[
                      e.fat?.value && `grasa ${fmt(e.fat.value)} ${unitLabel(e.fat.unit)}`,
                      e.muscle?.value && `músculo ${fmt(e.muscle.value)} ${unitLabel(e.muscle.unit)}`,
                      e.water?.value && `agua ${fmt(e.water.value)} ${unitLabel(e.water.unit)}`,
                    ].filter(Boolean).join(' · ') || 'solo peso'}
                    {(e.fat?.value || e.muscle?.value || e.water?.value) ? ` · ${METHODS[e.method] || 'Otro'}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MetricField({ label, value, onChange }) {
  return (
    <div className="metric-field">
      <Stepper label={label} value={value.value} onChange={(v) => onChange({ ...value, value: v })} step={0.1} allowEmpty />
      <div className="segmented unit-seg">
        <button type="button" className={value.unit === 'pct' ? 'on' : ''} onClick={() => onChange({ ...value, unit: 'pct' })}>%</button>
        <button type="button" className={value.unit === 'kg' ? 'on' : ''} onClick={() => onChange({ ...value, unit: 'kg' })}>kg</button>
      </div>
    </div>
  );
}

// Alta y edición de una medición.
export default function BodyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bodyMetrics } = useData();
  const existing = id !== 'nuevo' ? bodyMetrics.find((e) => e.id === id) : null;
  const prev = bodyMetrics[0]; // método y unidades de la última medición como valores por defecto
  const blank = (k) => ({ value: '', unit: prev?.[k]?.unit || 'pct' });
  const [f, setF] = useState(() => ({
    date: existing?.date || toISODate(now()),
    weightKg: existing?.weightKg ?? prev?.weightKg ?? '',
    method: existing?.method || prev?.method || 'bia',
    fat: existing?.fat ? { ...existing.fat } : blank('fat'),
    muscle: existing?.muscle ? { ...existing.muscle } : blank('muscle'),
    water: existing?.water ? { ...existing.water } : { value: '', unit: prev?.water?.unit || 'pct' },
  }));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const num = (v) => (v === '' || v == null || Number(v) <= 0 ? null : Math.round(Number(v) * 10) / 10);
  const comp = (m) => (num(m.value) ? { value: num(m.value), unit: m.unit } : null);
  const valid = num(f.weightKg) || comp(f.fat) || comp(f.muscle) || comp(f.water);

  function save() {
    if (!valid) return;
    saveBodyMetric(user.uid, existing?.id, {
      date: f.date,
      weightKg: num(f.weightKg),
      method: f.method,
      fat: comp(f.fat),
      muscle: comp(f.muscle),
      water: comp(f.water),
    });
    navigate('/progreso?vista=cuerpo');
  }

  return (
    <div className="page">
      <Header title={existing ? 'Editar medición' : 'Nueva medición'} back="/progreso?vista=cuerpo" />
      <div className="form">
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={f.date} max={toISODate(now())} onChange={(e) => set('date')(e.target.value)} />
        </label>
        <Stepper label="Peso" value={f.weightKg} onChange={set('weightKg')} step={0.1} suffix="kg" allowEmpty />

        <div className="field">
          <span>Método de la composición corporal</span>
          <select value={f.method} onChange={(e) => set('method')(e.target.value)}>
            {Object.entries(METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="muted small">Solo se comparan entre sí las mediciones del mismo método y unidad.</span>
        </div>
        <MetricField label="Grasa (opcional)" value={f.fat} onChange={set('fat')} />
        <MetricField label="Músculo (opcional)" value={f.muscle} onChange={set('muscle')} />
        <MetricField label="Agua (opcional)" value={f.water} onChange={set('water')} />

        <button className="btn primary wide" disabled={!valid} onClick={save}>Guardar</button>
        {existing && (
          <button
            className="btn danger-ghost wide"
            onClick={() => {
              if (!window.confirm('¿Borrar esta medición?')) return;
              deleteBodyMetric(user.uid, existing.id);
              navigate('/progreso?vista=cuerpo');
            }}
          >
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}


