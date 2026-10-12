import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { plannedSessionFor, WEEKDAYS, weekdayIndex, sequenceLetter, cardioSummary } from '../lib/routine';
import { describeLoad } from '../lib/load';
import { Header, Empty } from '../components/ui';

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
              <ul className="plain-list">
                {session.items.map((it) => {
                  if (it.kind === 'cardio') return <li key={it.id}>Cardio · {it.cardioType} <span className="muted">{cardioSummary(it)}</span></li>;
                  const ex = exerciseById(it.exerciseId);
                  return (
                    <li key={it.id}>
                      {ex?.name || 'Ejercicio'}{' '}
                      <span className="muted">{it.sets} × {it.repMin}–{it.repMax} · {describeLoad(it.loadKg, ex?.loadType, it.barKg)}</span>
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
