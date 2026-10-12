import { useState } from 'react';
import { Modal, Stepper } from './ui';
import { LOAD_TYPES, inputToStored, storedToInput, describeLoad } from '../lib/load';
import { CARDIO_TYPES } from '../lib/routine';
import MuscleChips from './MuscleChips';

export function StrengthItemEditor({ item, exercise, onSave, onDelete, onClose }) {
  const lt = exercise?.loadType || 'total';
  const [f, setF] = useState({
    sets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    barKg: item.barKg,
    input: storedToInput(item.loadKg, lt, item.barKg),
    restSec: item.restSec,
    incrementKg: item.incrementKg,
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const loadKg = inputToStored(f.input, lt, f.barKg);
  const rangeOk = Number(f.repMin) >= 1 && Number(f.repMin) <= Number(f.repMax);

  const save = () =>
    rangeOk &&
    onSave({
      ...item,
      sets: Number(f.sets),
      repMin: Number(f.repMin),
      repMax: Number(f.repMax),
      barKg: lt === 'barbell' ? Number(f.barKg) : 0,
      loadKg,
      restSec: Number(f.restSec),
      incrementKg: Number(f.incrementKg),
    });

  return (
    <Modal
      title={exercise?.name || 'Ejercicio'}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger-ghost" onClick={onDelete}>Quitar</button>
          <button className="btn primary" disabled={!rangeOk} onClick={save}>Listo</button>
        </>
      }
    >
      {exercise && <MuscleChips primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />}
      <div className="grid-2">
        <Stepper label="Series" value={f.sets} onChange={set('sets')} min={1} max={20} />
        <span />
        <Stepper label="Reps mínimo" value={f.repMin} onChange={set('repMin')} min={1} max={100} />
        <Stepper label="Reps máximo" value={f.repMax} onChange={set('repMax')} min={1} max={100} />
      </div>
      {!rangeOk && <p className="error small">El mínimo no puede superar al máximo.</p>}

      <div className="grid-2">
        <Stepper label={LOAD_TYPES[lt].input} value={f.input} onChange={set('input')} step={lt === 'barbell' ? 1.25 : lt === 'dumbbell' ? 1 : 2.5} />
        {lt === 'barbell' ? <Stepper label="Barra kg" value={f.barKg} onChange={set('barKg')} step={2.5} /> : <span />}
      </div>
      <p className="muted small load-preview">{describeLoad(loadKg, lt, f.barKg)}</p>

      <div className="grid-2">
        <Stepper label="Descanso (s)" value={f.restSec} onChange={set('restSec')} step={15} min={0} max={900} />
        <Stepper label="Incremento kg" value={f.incrementKg} onChange={set('incrementKg')} step={0.5} min={0.5} />
      </div>
      <p className="muted small">
        Progresión: si completas {f.repMax} reps en todas las series, la app propondrá subir {String(f.incrementKg).replace('.', ',')} kg
        {lt === 'barbell' ? ' en total' : lt === 'dumbbell' ? ' por mancuerna' : ''}.
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
