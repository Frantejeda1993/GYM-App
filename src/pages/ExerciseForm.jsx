import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { createExercise, updateExercise } from '../lib/db';
import { MUSCLE_KEYS, muscleLabel } from '../lib/muscles';
import { LOAD_TYPES, LOAD_TYPE_KEYS } from '../lib/load';
import { similarity } from '../lib/text';
import { EQUIPMENT, EQUIPMENT_KEYS, equipmentLabel } from '../lib/equipment';
import { resizeImage } from '../lib/image';
import { Header, Stepper, Empty } from '../components/ui';
import MuscleChips from '../components/MuscleChips';
import { FrameAnimation, VideoLink, PersonalNotesEditor } from '../components/ExerciseInfo';

export default function ExerciseForm() {
  const { id: rawId } = useParams();
  const id = rawId ? decodeURIComponent(rawId) : null;
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { catalog, exerciseById } = useData();
  const existing = id ? exerciseById(id) : null;
  const editable = !id || (existing?.source === 'user' && existing.createdBy === user.uid);

  if (id && !existing) {
    return (
      <div className="page">
        <Header title="Ejercicio" back="/ejercicios" />
        <Empty title="Ejercicio no encontrado" />
      </div>
    );
  }
  if (!editable) return <ExerciseView exercise={existing} />;
  return <ExerciseEditor existing={existing} catalog={catalog} user={user} profile={profile} navigate={navigate} />;
}

function ExerciseView({ exercise: e }) {
  return (
    <div className="page">
      <Header title="Ejercicio" back />
      <div className="card">
        <h2 className="card-title">{e.displayName}</h2>
        {e.alias && <p className="muted small">{e.name}</p>}
        <FrameAnimation images={e.images} />
        <VideoLink exercise={e} />
        <p className="muted">{equipmentLabel(e.equipment)} · {LOAD_TYPES[e.loadType]?.label}{e.loadType === 'barbell' && e.defaultBarKg ? ` · barra ${e.defaultBarKg} kg` : ''}</p>
        <div className="kv"><span>Músculos principales</span><MuscleChips primary={e.primaryMuscles} /></div>
        {e.secondaryMuscles?.length > 0 && (
          <div className="kv"><span>Secundarios</span><MuscleChips secondary={e.secondaryMuscles} /></div>
        )}
        <p><Link className="link" to={`/progreso/${encodeURIComponent(e.id)}`}>Ver mi progreso</Link></p>
        <p className="muted small">
          {e.source === 'seed' ? 'Catálogo base (free-exercise-db)' : `Creado por ${e.createdByName || 'otro usuario'}`}
        </p>
      </div>
      <div className="card">
        <PersonalNotesEditor key={e.id} exercise={e} />
      </div>
    </div>
  );
}

// embedded: dentro de otro flujo (p. ej. "+ Ejercicio" de la rutina). onSaved(ejercicio) y
// onPickExisting(ejercicio) sustituyen a la navegación.
export function ExerciseEditor({ existing, catalog, user, profile, navigate, embedded, initialName = '', onSaved, onPickExisting }) {
  const [name, setName] = useState(existing?.name || initialName);
  const [equipment, setEquipment] = useState(existing?.equipment || 'barbell');
  const [loadType, setLoadType] = useState(existing?.loadType || 'barbell');
  const [imageData, setImageData] = useState(existing?.imageData || null);
  const [imageData2, setImageData2] = useState(existing?.imageData2 || null);
  const [imgError, setImgError] = useState('');
  const [barKg, setBarKg] = useState(existing?.defaultBarKg ?? profile?.defaultBarKg ?? 20);
  const [primary, setPrimary] = useState(existing?.primaryMuscles || []);
  const [secondary, setSecondary] = useState(existing?.secondaryMuscles || []);
  const [ignoreSimilar, setIgnoreSimilar] = useState(!!existing);

  const similar = useMemo(() => {
    if (existing || name.trim().length < 3) return [];
    return catalog
      .map((e) => ({ e, s: similarity(name, e.name) }))
      .filter((x) => x.s >= 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.e);
  }, [name, catalog, existing]);

  const cycle = (m) => {
    // Toque: ninguno → principal → secundario → ninguno
    if (primary.includes(m)) {
      setPrimary(primary.filter((x) => x !== m));
      setSecondary([...secondary, m]);
    } else if (secondary.includes(m)) {
      setSecondary(secondary.filter((x) => x !== m));
    } else {
      setPrimary([...primary, m]);
    }
  };

  const blockedBySimilar = similar.length > 0 && !ignoreSimilar;
  const valid = name.trim() && primary.length > 0 && !blockedBySimilar;

  function save() {
    if (!valid) return;
    const data = {
      name: name.trim(),
      loadType,
      defaultBarKg: loadType === 'barbell' ? Number(barKg) || 0 : null,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      equipment,
      // Si solo hay foto final, pasa a ser la única foto.
      imageData: imageData || imageData2 || null,
      imageData2: imageData ? imageData2 || null : null,
    };
    if (existing) {
      updateExercise(existing.id, data);
      navigate('/ejercicios');
      return;
    }
    const id = createExercise(user, data);
    if (onSaved) onSaved({ id, ...data, source: 'user', displayName: data.name, images: [data.imageData, data.imageData2].filter(Boolean) });
    else navigate('/ejercicios');
  }

  function archive() {
    if (!window.confirm('¿Archivar este ejercicio? Dejará de aparecer en el catálogo; las rutinas que lo usan lo conservan.')) return;
    updateExercise(existing.id, { archived: true });
    navigate('/ejercicios');
  }

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded && <Header title={existing ? 'Editar ejercicio' : 'Nuevo ejercicio'} back />}
      <div className="form">
        <label className="field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => { setName(e.target.value); if (!existing) setIgnoreSimilar(false); }} placeholder="Ej. Press inclinado en máquina" />
        </label>

        {similar.length > 0 && !ignoreSimilar && (
          <div className="warn-box">
            <p><strong>¿Ya existe?</strong> Estos ejercicios se parecen. Usar uno existente mantiene tu historial unido.</p>
            <ul className="mini-list">
              {similar.map((e) => (
                <li key={e.id}>
                  <button type="button" className="link" onClick={() => (onPickExisting ? onPickExisting(e) : navigate(`/ejercicios/${encodeURIComponent(e.id)}`))}>{e.displayName || e.name}</button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn ghost" onClick={() => setIgnoreSimilar(true)}>No es ninguno, crear igualmente</button>
          </div>
        )}

        <div className="field">
          <span>Equipamiento</span>
          <div className="muscle-grid">
            {EQUIPMENT_KEYS.map((k) => (
              <button
                type="button"
                key={k}
                className={equipment === k ? 'chip-btn primary' : 'chip-btn'}
                onClick={() => { setEquipment(k); setLoadType(EQUIPMENT[k].loadType); }}
              >
                {equipmentLabel(k)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Fotos (opcional) · inicio y final para ver el movimiento</span>
          {[['Inicio', imageData, setImageData], ['Final', imageData2, setImageData2]].map(([label, value, setter]) => (
            <div className="photo-field" key={label}>
              {value ? <img src={value} alt="" /> : <span className="photo-empty">{label}</span>}
              <label className="btn small file-btn">
                {value ? `Cambiar ${label.toLowerCase()}` : `Foto de ${label.toLowerCase()}`}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = '';
                    if (!file) return;
                    try {
                      setImgError('');
                      setter(await resizeImage(file));
                    } catch (err) {
                      setImgError(err.message);
                    }
                  }}
                />
              </label>
              {value && <button type="button" className="btn small danger-ghost" onClick={() => setter(null)}>Quitar</button>}
            </div>
          ))}
          {(imageData || imageData2) && <FrameAnimation images={[imageData, imageData2].filter(Boolean)} />}
          {imgError && <p className="error small">{imgError}</p>}
        </div>

        <div className="field">
          <span>Tipo de carga</span>
          <div className="radio-list">
            {LOAD_TYPE_KEYS.map((k) => (
              <button type="button" key={k} className={loadType === k ? 'radio on' : 'radio'} onClick={() => setLoadType(k)}>
                {LOAD_TYPES[k].label}
              </button>
            ))}
          </div>
        </div>
        {loadType === 'barbell' && <Stepper label="Peso de la barra" value={barKg} onChange={setBarKg} step={2.5} suffix="kg" />}

        <div className="field">
          <span>Músculos <small className="muted">(1 toque: principal · 2 toques: secundario)</small></span>
          <div className="muscle-grid">
            {MUSCLE_KEYS.map((m) => (
              <button
                type="button"
                key={m}
                className={primary.includes(m) ? 'chip-btn primary' : secondary.includes(m) ? 'chip-btn secondary' : 'chip-btn'}
                onClick={() => cycle(m)}
              >
                {muscleLabel(m)}
              </button>
            ))}
          </div>
        </div>

        <button className="btn primary wide" disabled={!valid} onClick={save}>Guardar</button>
        {existing && <button className="btn danger-ghost wide" onClick={archive}>Archivar</button>}
      </div>
      {existing && (
        <div className="card mt8">
          <PersonalNotesEditor key={existing.id} exercise={existing} />
        </div>
      )}
    </div>
  );
}
