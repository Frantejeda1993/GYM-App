import { useState } from 'react';
import { Modal, Stepper } from './ui';
import { LOAD_TYPES, inputToStored, storedToInput, describeLoad, describeItemLoad } from '../lib/load';
import { CARDIO_TYPES } from '../lib/routine';
import MuscleChips from './MuscleChips';
import ExerciseThumb from './ExerciseThumb';
import { useAuth } from '../auth';
import { saveExerciseNote } from '../lib/db';

export function StrengthItemEditor({ item, exercise, onSave, onDelete, onClose }) {
  const { user } = useAuth();
  const lt = exercise?.loadType || 'total';
  const [alias, setAlias] = useState(exercise?.alias || '');
  const toInput = (v) => storedToInput(v, lt, item.barKg);
  const [f, setF] = useState({
    sets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    reps: item.reps ?? '',
    barKg: item.barKg,
    loadMode: item.loadMode || 'fixed',
    input: toInput(item.loadKg),
    // Pesos por serie en unidades de entrada (por lado / por mano / total)
    inputs: Array.from({ length: item.sets }, (_, i) => toInput(item.setLoads?.[i] ?? item.setLoads?.at(-1) ?? item.loadKg)),
    restSec: item.restSec,
    incrementKg: item.incrementKg,
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const setSets = (v) =>
    setF((x) => {
      const n = Math.max(1, Number(v) || 1);
      const inputs = Array.from({ length: n }, (_, i) => x.inputs[i] ?? x.inputs.at(-1) ?? x.input);
      return { ...x, sets: n, inputs };
    });
  const setInputAt = (i) => (v) => setF((x) => ({ ...x, inputs: x.inputs.map((old, j) => (j === i ? v : old)) }));

  const progressive = f.loadMode === 'progressive';
  const setLoads = f.inputs.map((v) => inputToStored(v, lt, f.barKg));
  const loadKg = progressive ? Math.max(...setLoads) : inputToStored(f.input, lt, f.barKg);
  const rangeOk = Number(f.repMin) >= 1 && Number(f.repMin) <= Number(f.repMax);
  const reps = f.reps === '' || Number(f.reps) === 0 ? null : Number(f.reps);
  const repsOutside = reps != null && rangeOk && (reps < Number(f.repMin) || reps > Number(f.repMax));
  const step = lt === 'barbell' ? 1.25 : lt === 'dumbbell' ? 1 : 2.5;

  const save = () => {
    if (!rangeOk) return;
    // El apodo es personal y vale para todas las rutinas.
    if (exercise && alias.trim() !== (exercise.alias || '')) {
      saveExerciseNote(user.uid, exercise.id, { alias, notes: exercise.notes || '' });
    }
    onSave({
      ...item,
      sets: Number(f.sets),
      repMin: Number(f.repMin),
      repMax: Number(f.repMax),
      reps,
      barKg: lt === 'barbell' ? Number(f.barKg) : 0,
      loadMode: f.loadMode,
      setLoads: progressive ? setLoads : null,
      loadKg,
      restSec: Number(f.restSec),
      incrementKg: Number(f.incrementKg),
    });
  };

  return (
    <Modal
      title={exercise?.displayName || 'Ejercicio'}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger-ghost" onClick={onDelete}>Quitar</button>
          <button className="btn primary" disabled={!rangeOk} onClick={save}>Listo</button>
        </>
      }
    >
      {exercise && (
        <div className="today-item">
          <ExerciseThumb exercise={exercise} size={64} />
          <MuscleChips primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
        </div>
      )}
      {exercise && (
        <label className="field mt8">
          <span>Mi apodo (opcional, para todas tus rutinas)</span>
          <input value={alias} placeholder={exercise.name} onChange={(e) => setAlias(e.target.value)} />
        </label>
      )}
      <div className="grid-2">
        <Stepper label="Series" value={f.sets} onChange={setSets} min={1} max={20} />
        <span />
        <Stepper label="Reps mínimo" value={f.repMin} onChange={set('repMin')} min={1} max={100} />
        <Stepper label="Reps máximo" value={f.repMax} onChange={set('repMax')} min={1} max={100} />
      </div>
      {!rangeOk && <p className="error small">El mínimo no puede superar al máximo.</p>}
      <div className="grid-2">
        <Stepper label="Reps actuales (opcional)" value={f.reps} onChange={set('reps')} min={0} max={100} allowEmpty />
        <span />
      </div>
      <p className="muted small">
        {repsOutside
          ? 'Fuera del rango: la progresión propondrá ajustar la carga.'
          : 'Las que haces hoy dentro del rango. Si lo dejas vacío, se parte del mínimo.'}
      </p>

      <div className="field mt8">
        <span>Peso</span>
        <div className="segmented">
          <button type="button" className={!progressive ? 'on' : ''} onClick={() => set('loadMode')('fixed')}>Fijo</button>
          <button type="button" className={progressive ? 'on' : ''} onClick={() => setF((x) => ({ ...x, loadMode: 'progressive', inputs: x.inputs.map(() => x.input) }))}>Progresivo</button>
        </div>
        <span className="muted small">{progressive ? 'Un peso distinto en cada serie (pirámide).' : 'El mismo peso en todas las series.'}</span>
      </div>

      {lt === 'barbell' && (
        <div className="grid-2">
          <Stepper label="Barra kg" value={f.barKg} onChange={set('barKg')} step={2.5} />
          <span />
        </div>
      )}
      {progressive ? (
        <div className="grid-2">
          {f.inputs.map((v, i) => (
            <Stepper key={i} label={`Serie ${i + 1} · ${LOAD_TYPES[lt].input}`} value={v} onChange={setInputAt(i)} step={step} />
          ))}
        </div>
      ) : (
        <div className="grid-2">
          <Stepper label={LOAD_TYPES[lt].input} value={f.input} onChange={set('input')} step={step} />
          <span />
        </div>
      )}
      <p className="muted small load-preview">
        {progressive ? describeItemLoad({ loadMode: 'progressive', setLoads, barKg: f.barKg }, lt) : describeLoad(loadKg, lt, f.barKg)}
      </p>

      <div className="grid-2">
        <Stepper label="Descanso (s)" value={f.restSec} onChange={set('restSec')} step={15} min={0} max={900} />
        <Stepper label="Incremento kg" value={f.incrementKg} onChange={set('incrementKg')} step={0.5} min={0.5} />
      </div>
      <p className="muted small">
        Progresión: si completas {f.repMax} reps en todas las series, la app propondrá subir {String(f.incrementKg).replace('.', ',')} kg
        {lt === 'barbell' ? ' en total' : lt === 'dumbbell' ? ' por mancuerna' : ''}{progressive ? ' en cada serie' : ''}.
      </p>
    </Modal>
  );
}

export function CardioItemEditor({ item, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ ...item });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const hasTarget = [f.minutes, f.steps, f.kcal].some((v) => Number(v) > 0);
  const clean = (v) => (v === '' || v == null || Number(v) === 0 ? null : Number(v));

  return (
    <Modal
      title="Cardio"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger-ghost" onClick={onDelete}>Quitar</button>
          <button className="btn primary" disabled={!hasTarget} onClick={() => onSave({ ...f, minutes: clean(f.minutes), steps: clean(f.steps), kcal: clean(f.kcal) })}>Listo</button>
        </>
      }
    >
      <div className="field">
        <span>Tipo</span>
        <div className="muscle-grid">
          {CARDIO_TYPES.map((t) => (
            <button type="button" key={t} className={f.cardioType === t ? 'chip-btn primary' : 'chip-btn'} onClick={() => set('cardioType')(t)}>{t}</button>
          ))}
        </div>
      </div>
      <p className="muted small">Indica al menos uno: minutos, pasos o calorías.</p>
      <Stepper label="Minutos" value={f.minutes ?? ''} onChange={set('minutes')} step={5} allowEmpty />
      <Stepper label="Pasos" value={f.steps ?? ''} onChange={set('steps')} step={500} allowEmpty />
      <Stepper label="Calorías" value={f.kcal ?? ''} onChange={set('kcal')} step={25} allowEmpty />
    </Modal>
  );
}
