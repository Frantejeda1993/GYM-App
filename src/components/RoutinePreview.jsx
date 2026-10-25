import { useData } from '../data';
import { WEEKDAYS, sequenceLetter, setsLabel, cardioSummary } from '../lib/routine';
import ExerciseThumb from './ExerciseThumb';

// Vista de solo lectura de una rutina: sesiones con sus ejercicios.
export default function RoutinePreview({ routine }) {
  const { exerciseById } = useData();
  const sessions = [...(routine.templateSessions || [])].sort((a, b) =>
    routine.mode === 'weekly' ? a.weekday - b.weekday : a.order - b.order,
  );
  return (
    <div className="days">
      {sessions.map((s, i) => (
        <div key={s.id} className="day">
          <div className="day-head">
            <strong>{routine.mode === 'weekly' ? WEEKDAYS[s.weekday] : sequenceLetter(i)}</strong>
            <span className="muted small">{s.name}</span>
          </div>
          <ul className="preview-items">
            {(s.items || []).map((it) => {
              if (it.kind === 'cardio') return <li key={it.id}><span>Cardio · {it.cardioType}</span><span className="muted small">{cardioSummary(it)}</span></li>;
              const ex = exerciseById(it.exerciseId);
              return (
                <li key={it.id}>
                  {ex && <ExerciseThumb exercise={ex} size={36} />}
                  <span className={ex ? '' : 'muted'}>{ex?.displayName || 'Ejercicio no disponible'}</span>
                  <span className="muted small">{setsLabel(it)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
