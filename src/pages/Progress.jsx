import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../data';
import { exerciseHistory, trainedExercises } from '../lib/progress';
import { describeLoad } from '../lib/load';
import { formatDay, parseISODate } from '../lib/dates';
import { Header, Empty } from '../components/ui';
import ExerciseThumb from '../components/ExerciseThumb';
import LineChart from '../components/LineChart';
import MuscleDashboard from '../components/MuscleDashboard';
import { BodyView } from './Body';

const shortDate = (iso) => parseISODate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const fmt = (v) => String(v).replace('.', ',');

export default function Progress() {
  const navigate = useNavigate();
  const { sessions, exerciseById, loaded } = useData();
  const list = useMemo(() => trainedExercises(sessions), [sessions]);
  const [params, setParams] = useSearchParams();
  const view = params.get('vista') || 'musculos';
  const tabs = [['musculos', 'Músculos'], ['ejercicios', 'Ejercicios'], ['cuerpo', 'Cuerpo']];
  return (
    <div className="page">
      <Header title="Progreso" />
      <div className="segmented three">
        {tabs.map(([k, l]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setParams(k === 'musculos' ? {} : { vista: k }, { replace: true })}>{l}</button>
        ))}
      </div>
      <div className="mt8" />
      {view === 'musculos' && <MuscleDashboard />}
      {view === 'cuerpo' && <BodyView />}
      {view === 'ejercicios' && (<>
      {loaded && !list.length && (
        <Empty title="Aún no hay sesiones finalizadas">
          <p className="muted small">Cuando finalices tu primera sesión verás aquí la evolución de cada ejercicio.</p>
        </Empty>
      )}
      <ul className="list">
        {list.map((x) => {
          const ex = exerciseById(x.exerciseId);
          const h = exerciseHistory(sessions, x.exerciseId);
          const first = h.find((p) => p.best1rm != null)?.best1rm;
          const last = [...h].reverse().find((p) => p.best1rm != null)?.best1rm;
          const diff = first != null && last != null && h.length > 1 ? Math.round((last - first) * 10) / 10 : null;
          return (
            <li key={x.exerciseId}>
              <button className="row-btn with-thumb" onClick={() => navigate(`/progreso/${encodeURIComponent(x.exerciseId)}`)}>
                <ExerciseThumb exercise={ex || { name: x.name }} />
                <span className="row-text">
                  <span className="row-title">{ex?.name || x.name}</span>
                  <span className="row-sub">
                    {x.count} {x.count === 1 ? 'sesión' : 'sesiones'} · última {shortDate(x.lastDate)}
                    {last != null && ` · 1RM ${fmt(last)} kg`}
                  </span>
                  {diff != null && diff !== 0 && <span className={diff > 0 ? 'trend up' : 'trend down'}>{diff > 0 ? '▲' : '▼'} {fmt(Math.abs(diff))} kg desde el inicio</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      </>)}
    </div>
  );
}

export function ProgressDetail() {
  const { id } = useParams();
  const exerciseId = decodeURIComponent(id);
  const { sessions, exerciseById } = useData();
  const ex = exerciseById(exerciseId);
  const history = useMemo(() => exerciseHistory(sessions, exerciseId), [sessions, exerciseId]);
  const with1rm = history.filter((p) => p.best1rm != null);
  const use1rm = with1rm.length > 0;
  const lt = history[0]?.loadType || ex?.loadType;
  const setText = (p) => `${describeLoad(p.bestSet.kg, p.loadType, p.barKg)} × ${p.bestSet.reps}`;
  const points = use1rm
    ? with1rm.map((p) => ({ x: shortDate(p.date), y: p.best1rm, tip: `${shortDate(p.date)} · mejor serie ${setText(p)}` }))
    : history.map((p) => ({ x: shortDate(p.date), y: p.maxReps, tip: `${shortDate(p.date)} · ${p.sets} series` }));
  const best = use1rm ? with1rm.reduce((a, b) => (b.best1rm > a.best1rm ? b : a)) : null;

  return (
    <div className="page">
      <Header title="Progreso" back="/progreso?vista=ejercicios" />
      <div className="today-item">
        <ExerciseThumb exercise={ex || { name: history[0]?.name }} size={56} />
        <div className="row-text">
          <span className="row-title">{ex?.name || 'Ejercicio'}</span>
          <Link className="link small" to={`/ejercicios/${encodeURIComponent(exerciseId)}`}>Ver ficha</Link>
        </div>
      </div>

      {!history.length ? (
        <Empty title="Sin registros todavía" />
      ) : (
        <>
          <div className="stats">
            {best && (
              <div className="stat">
                <span className="stat-label">Mejor 1RM estimado</span>
                <span className="stat-value">{fmt(best.best1rm)} kg</span>
                <span className="stat-sub">{shortDate(best.date)} · {setText(best)}</span>
              </div>
            )}
            <div className="stat">
              <span className="stat-label">Sesiones</span>
              <span className="stat-value">{history.length}</span>
              <span className="stat-sub">desde {shortDate(history[0].date)}</span>
            </div>
          </div>

          <p className="filter-label">{use1rm ? '1RM estimado por sesión (kg)' : 'Repeticiones máximas por sesión'}</p>
          <LineChart points={points} unit={use1rm ? 'kg' : 'reps'} ariaLabel={`Evolución de ${ex?.name || 'ejercicio'}`} />
          {use1rm && <p className="muted small">1RM estimado con la fórmula de Epley a partir de la mejor serie (hasta 12 reps).{lt === 'dumbbell' ? ' En mancuernas, por mano.' : ''}</p>}

          <p className="filter-label mt8">Sesiones</p>
          <table className="hist">
            <thead>
              <tr><th>Fecha</th><th>Mejor serie</th><th>Series</th><th>Volumen</th></tr>
            </thead>
            <tbody>
              {[...history].reverse().map((p) => (
                <tr key={p.sessionId + p.date}>
                  <td>{formatDay(p.date).replace(/^\w+,?\s*/, '')}</td>
                  <td>{setText(p)}</td>
                  <td>{p.sets}</td>
                  <td>{p.volume.toLocaleString('es-ES')} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
