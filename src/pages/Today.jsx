import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { plannedSessionFor, WEEKDAYS, weekdayIndex, sequenceLetter, cardioSummary, setsLabel } from '../lib/routine';
import { describeLoad } from '../lib/load';
import { Header, Empty } from '../components/ui';
import ExerciseThumb from '../components/ExerciseThumb';

export default function Today() {
  const { profile } = useAuth();
  const { activeRoutine, exerciseById, loaded } = useData();
  const today = WEEKDAYS[weekdayIndex()];
  const session = plannedSessionFor(activeRoutine);

  return (
    <div className="page">
      <Header title={`Hola, ${profile?.name || ''}`} />
      {loaded && !activeRoutine && (
        <Empty title="No tienes una rutina activa">
          <Link className="btn primary" to="/rutinas">Crear rutina</Link>
        </Empty>
      )}

      {activeRoutine && (
        <div className="card">
          <p className="eyebrow">{activeRoutine.mode === 'weekly' ? today : `Siguiente en la secuencia`} · {activeRoutine.name}</p>
          {session ? (
            <>
              <h2 className="card-title">
                {activeRoutine.mode === 'sequential' && `${sequenceLetter(activeRoutine.nextSequenceIndex || 0)} · `}
                {session.name}
              </h2>
              <ul className="today-list">
                {session.items.map((it) => {
                  if (it.kind === 'cardio') return <li key={it.id}>Cardio · {it.cardioType} <span className="muted">{cardioSummary(it)}</span></li>;
                  const ex = exerciseById(it.exerciseId);
                  return (
                    <li key={it.id} className="today-item">
                      <ExerciseThumb exercise={ex} size={48} />
                      <span className="row-text">
                        <span className="row-title">{ex?.name || 'Ejercicio'}</span>
                        <span className="row-sub">{setsLabel(it)} · {describeLoad(it.loadKg, ex?.loadType, it.barKg)}</span>
                      </span>
                    </li>
                  );
                })}
                {session.items.length === 0 && <li className="muted">Sesión sin ejercicios todavía.</li>}
              </ul>
              <button className="btn primary wide" disabled>Iniciar sesión (fase 2)</button>
            </>
          ) : (
            <p className="muted">Hoy es día de descanso.</p>
          )}
        </div>
      )}
    </div>
  );
}
