import { useMemo, useState } from 'react';
import { useData } from '../data';
import { MUSCLE_KEYS, muscleLabel } from '../lib/muscles';
import { EQUIPMENT_KEYS, equipmentLabel } from '../lib/equipment';
import { normalize } from '../lib/text';
import MuscleChips from './MuscleChips';
import ExerciseThumb from './ExerciseThumb';
import { AnimationModal } from './ExerciseInfo';

const PAGE = 50;
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// Lista buscable y filtrable del catálogo. onSelect recibe el ejercicio.
// Tocar la miniatura abre la animación. onCreate(nombre) muestra "Crear ejercicio".
// selectLabel: texto del botón de la vista previa para elegir el ejercicio.
export default function ExerciseList({ onSelect, autoFocus, onCreate, selectLabel }) {
  const [preview, setPreview] = useState(null);
  const { catalog } = useData();
  const [q, setQ] = useState('');
  const [muscles, setMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const activeFilters = muscles.length + equipment.length + (onlyMine ? 1 : 0);

  const results = useMemo(() => {
    const words = normalize(q).split(' ').filter(Boolean);
    // Varios músculos: aparece si trabaja cualquiera de ellos; primero los que trabajan más
    // de los seleccionados y como músculo principal.
    const score = (e) =>
      muscles.reduce((acc, m) => acc + (e.primaryMuscles?.includes(m) ? 2 : e.secondaryMuscles?.includes(m) ? 1 : 0), 0);
    return catalog
      .filter((e) => {
        if (onlyMine && e.source !== 'user') return false;
        if (equipment.length && !equipment.includes(e.equipment || 'other')) return false;
        if (muscles.length && score(e) === 0) return false;
        return words.every((w) => e.nameNormalized.includes(w) || e.aliasNormalized?.includes(w));
      })
      .map((e) => ({ e, s: muscles.length ? score(e) : 0 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
  }, [catalog, q, muscles, equipment, onlyMine]);

  const reset = () => setLimit(PAGE);

  return (
    <div className="exlist">
      <div className="search-row">
        <input
          className="search"
          type="search"
          placeholder="Buscar (inglés o tu apodo)"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); reset(); }}
        />
        <button type="button" className={activeFilters ? 'toggle on' : 'toggle'} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Filtros{activeFilters ? ` · ${activeFilters}` : ''}
        </button>
      </div>

      {open && (
        <div className="filters">
          <p className="filter-label">Músculos</p>
          <div className="muscle-grid">
            {MUSCLE_KEYS.map((m) => (
              <button type="button" key={m} className={muscles.includes(m) ? 'chip-btn primary' : 'chip-btn'} onClick={() => { setMuscles(toggle(muscles, m)); reset(); }}>
                {muscleLabel(m)}
              </button>
            ))}
          </div>
          <p className="filter-label">Equipamiento</p>
          <div className="muscle-grid">
            {EQUIPMENT_KEYS.map((k) => (
              <button type="button" key={k} className={equipment.includes(k) ? 'chip-btn primary' : 'chip-btn'} onClick={() => { setEquipment(toggle(equipment, k)); reset(); }}>
                {equipmentLabel(k)}
              </button>
            ))}
          </div>
          <div className="filter-foot">
            <button type="button" className={onlyMine ? 'chip-btn primary' : 'chip-btn'} onClick={() => { setOnlyMine((v) => !v); reset(); }}>
              Solo creados por usuarios
            </button>
            {activeFilters > 0 && (
              <button type="button" className="link" onClick={() => { setMuscles([]); setEquipment([]); setOnlyMine(false); reset(); }}>
                Quitar filtros
              </button>
            )}
          </div>
        </div>
      )}

      <p className="muted small">{results.length} ejercicios</p>
      {onCreate && (
        <button type="button" className="btn wide create-btn" onClick={() => onCreate(q.trim())}>
          + Crear ejercicio{q.trim() ? ` "${q.trim()}"` : ' nuevo'}
        </button>
      )}
      <ul className="list">
        {results.slice(0, limit).map((e) => (
          <li key={e.id} className="ex-row">
            <button type="button" className="thumb-btn" onClick={() => setPreview(e)} aria-label={`Ver animación de ${e.displayName}`}>
              <ExerciseThumb exercise={e} />
            </button>
            <button type="button" className="row-btn" onClick={() => onSelect(e)}>
              <span className="row-text">
                <span className="row-title">
                  {e.displayName}
                  {e.source === 'user' && <span className="badge">usuario</span>}
                </span>
                <span className="row-sub">{e.alias ? `${e.name} · ` : ''}{equipmentLabel(e.equipment)}</span>
                <MuscleChips primary={e.primaryMuscles} secondary={e.secondaryMuscles} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {preview && (
        <AnimationModal
          exercise={preview}
          onClose={() => setPreview(null)}
          action={selectLabel ? { label: selectLabel, onClick: () => { const e = preview; setPreview(null); onSelect(e); } } : null}
        />
      )}
      {results.length > limit && (
        <button type="button" className="btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>Ver más</button>
      )}
    </div>
  );
}
