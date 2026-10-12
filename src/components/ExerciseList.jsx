import { useMemo, useState } from 'react';
import { useData } from '../data';
import { MUSCLE_KEYS, muscleLabel } from '../lib/muscles';
import { LOAD_TYPES } from '../lib/load';
import { normalize } from '../lib/text';
import MuscleChips from './MuscleChips';

const PAGE = 60;

// Lista buscable y filtrable del catálogo. onSelect recibe el ejercicio.
export default function ExerciseList({ onSelect, autoFocus }) {
  const { catalog } = useData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const words = normalize(q).split(' ').filter(Boolean);
    return catalog.filter((e) => {
      if (onlyMine && e.source !== 'user') return false;
      if (muscle && !e.primaryMuscles?.includes(muscle) && !e.secondaryMuscles?.includes(muscle)) return false;
      if (!words.length) return true;
      return words.every((w) => e.nameNormalized.includes(w));
    }).sort((a, b) => {
      // Primero los que tienen el músculo filtrado como principal.
      if (!muscle) return 0;
      return (b.primaryMuscles?.includes(muscle) ? 1 : 0) - (a.primaryMuscles?.includes(muscle) ? 1 : 0);
    });
  }, [catalog, q, muscle, onlyMine]);

  return (
    <div className="exlist">
      <input
        className="search"
        type="search"
        placeholder="Buscar ejercicio (en inglés: bench, squat…)"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(PAGE);
        }}
      />
      <div className="filter-row">
        <select value={muscle} onChange={(e) => { setMuscle(e.target.value); setLimit(PAGE); }}>
          <option value="">Músculo: todos</option>
          {MUSCLE_KEYS.map((m) => (
            <option key={m} value={m}>{muscleLabel(m)}</option>
          ))}
        </select>
        <button type="button" className={onlyMine ? 'toggle on' : 'toggle'} onClick={() => setOnlyMine((v) => !v)}>
          Creados por usuarios
        </button>
      </div>
      <p className="muted small">{results.length} ejercicios</p>
      <ul className="list">
        {results.slice(0, limit).map((e) => (
          <li key={e.id}>
            <button type="button" className="row-btn" onClick={() => onSelect(e)}>
              <span className="row-title">
                {e.name}
                {e.source === 'user' && <span className="badge">usuario</span>}
              </span>
              <span className="row-sub">{LOAD_TYPES[e.loadType]?.short}</span>
              <MuscleChips primary={e.primaryMuscles} secondary={e.secondaryMuscles} />
            </button>
          </li>
        ))}
      </ul>
      {results.length > limit && (
        <button type="button" className="btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>
          Ver más
        </button>
      )}
    </div>
  );
}
