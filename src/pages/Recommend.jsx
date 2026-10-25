import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { saveProfile } from '../lib/db';
import { GOALS, LEVELS, EQUIPMENT, recommendRoutine } from '../lib/recommend';
import { Header, Stepper } from '../components/ui';
import RoutinePreview from '../components/RoutinePreview';

function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`}>
      {Object.entries(options).map(([k, l]) => (
        <button type="button" key={k} className={String(value) === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

// Rutina recomendada a partir de peso, altura, objetivo y disponibilidad.
export default function Recommend() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { bodyMetrics, exerciseById } = useData();
  const lastWeight = bodyMetrics.find((e) => e.weightKg > 0)?.weightKg ?? '';
  const [f, setF] = useState({
    weightKg: lastWeight,
    heightCm: profile?.heightCm ?? '',
    goal: 'musculo',
    days: '3',
    level: 'beginner',
    equipment: 'gym',
  });
  const [shown, setShown] = useState(false);
  const set = (k) => (v) => {
    setShown(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  const valid = Number(f.weightKg) > 0 && Number(f.heightCm) > 0;
  const result = useMemo(
    () => (valid ? recommendRoutine({ ...f, weightKg: Number(f.weightKg), heightCm: Number(f.heightCm), days: Number(f.days) }, exerciseById, profile) : null),
    [f, valid, exerciseById, profile],
  );

  function show() {
    if (!valid) return;
    // La altura se guarda en el perfil para no pedirla otra vez (y para el FFMI de composición corporal)
    if (Number(f.heightCm) !== profile?.heightCm) saveProfile(user.uid, { heightCm: Number(f.heightCm) }, false).catch(console.error);
    setShown(true);
  }

  return (
    <div className="page has-sticky">
      <Header title="Rutina recomendada" back="/rutinas" />
      <div className="form">
        <Stepper label="Peso" value={f.weightKg} onChange={set('weightKg')} step={0.5} suffix="kg" allowEmpty />
        <Stepper label="Altura" value={f.heightCm} onChange={set('heightCm')} step={1} max={250} suffix="cm" allowEmpty />
        <div className="field">
          <span>Objetivo</span>
          <Segmented options={Object.fromEntries(Object.entries(GOALS).map(([k, g]) => [k, g.short]))} value={f.goal} onChange={set('goal')} className="four" />
        </div>
        <div className="field">
          <span>Días por semana</span>
          <Segmented options={{ 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }} value={f.days} onChange={set('days')} className="five" />
        </div>
        <div className="field">
          <span>Experiencia</span>
          <Segmented options={LEVELS} value={f.level} onChange={set('level')} />
        </div>
        <div className="field">
          <span>Material</span>
          <Segmented options={EQUIPMENT} value={f.equipment} onChange={set('equipment')} />
        </div>
        {!shown && <button className="btn primary wide" disabled={!valid} onClick={show}>{valid ? 'Ver propuesta' : 'Indica peso y altura'}</button>}
      </div>

      {shown && result && (
        <>
          <div className="verdict good mt8">
            <strong>{result.routine.name}</strong>
            <ul className="analysis-notes">
              {result.why.map((w) => <li key={w} className="small">{w}</li>)}
            </ul>
          </div>
          <RoutinePreview routine={result.routine} />
          <p className="muted small mt8">Propuesta orientativa. Si tienes lesiones o alguna condición médica, consúltala con un profesional.</p>
          <div className="sticky-foot">
            <button className="btn primary wide" onClick={() => navigate('/rutinas/nueva', { state: { draft: result.routine } })}>
              Usar y personalizar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
