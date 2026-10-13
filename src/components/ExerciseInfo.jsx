import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { saveExerciseNote } from '../lib/db';
import { Modal } from './ui';

// Alterna las dos imágenes (inicio / final) para mostrar el movimiento.
export function FrameAnimation({ images = [] }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (images.length < 2 || !playing) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % images.length), 900);
    return () => clearInterval(t);
  }, [images.length, playing]);
  if (!images.length) return null;
  return (
    <figure className="anim" onClick={() => setPlaying((p) => !p)}>
      {images.map((src, j) => (
        <img key={src} src={src} alt="" className={j === i ? 'on' : ''} />
      ))}
      {images.length > 1 && <figcaption>{i === 0 ? 'Inicio' : 'Final'}{playing ? '' : ' · pausa'}</figcaption>}
    </figure>
  );
}

// Búsqueda de vídeos de técnica en YouTube (no aloja vídeos: coste cero).
export const videoUrl = (exercise) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise technique`)}`;

export function VideoLink({ exercise }) {
  return (
    <a className="btn small ghost" href={videoUrl(exercise)} target="_blank" rel="noopener noreferrer">
      ▶ Ver vídeos de técnica
    </a>
  );
}

// Apodo y notas personales (solo los ve el usuario).
export function PersonalNotesEditor({ exercise, onSaved }) {
  const { user } = useAuth();
  const [alias, setAlias] = useState(exercise.alias || '');
  const [notes, setNotes] = useState(exercise.notes || '');
  const [saved, setSaved] = useState(false);
  const dirty = alias !== (exercise.alias || '') || notes !== (exercise.notes || '');
  return (
    <div className="form personal">
      <label className="field">
        <span>Mi apodo</span>
        <input value={alias} placeholder={exercise.name} onChange={(e) => { setAlias(e.target.value); setSaved(false); }} />
      </label>
      <label className="field">
        <span>Mis notas</span>
        <textarea
          rows={3}
          value={notes}
          placeholder="Ej. asiento en 4, polea en el agujero 7, agarre estrecho"
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        />
      </label>
      <button
        className="btn primary"
        disabled={!dirty}
        onClick={() => {
          saveExerciseNote(user.uid, exercise.id, { alias, notes });
          setSaved(true);
          onSaved?.();
        }}
      >
        Guardar apodo y notas
      </button>
      {saved && !dirty && <p className="ok small">Guardado. Solo lo ves tú.</p>}
    </div>
  );
}

// Ficha rápida durante la sesión: movimiento, vídeos, apodo y notas.
export function ExerciseInfoModal({ exercise, onClose }) {
  return (
    <Modal title={exercise.displayName} onClose={onClose}>
      {exercise.alias && <p className="muted small">{exercise.name}</p>}
      <FrameAnimation images={exercise.images} />
      <VideoLink exercise={exercise} />
      <div className="mt8" />
      <PersonalNotesEditor exercise={exercise} onSaved={onClose} />
    </Modal>
  );
}

// Animación en grande (al tocar una miniatura).
export function AnimationModal({ exercise, onClose }) {
  return (
    <Modal title={exercise.displayName || exercise.name} onClose={onClose}>
      {exercise.alias && <p className="muted small">{exercise.name}</p>}
      {exercise.images?.length ? <FrameAnimation images={exercise.images} /> : <p className="muted">Este ejercicio no tiene imágenes.</p>}
      <VideoLink exercise={exercise} />
      {exercise.notes && <p className="notes-line mt8">📝 {exercise.notes}</p>}
    </Modal>
  );
}
