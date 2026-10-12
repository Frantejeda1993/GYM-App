import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { saveRoutine } from '../lib/db';
import { WEEKDAYS, sequenceLetter, newSession, newStrengthItem, newCardioItem, cardioSummary } from '../lib/routine';
import { describeLoad } from '../lib/load';
import { Header, Modal, Empty } from '../components/ui';
import ExerciseList from '../components/ExerciseList';
import { StrengthItemEditor, CardioItemEditor } from '../components/ItemEditors';

export default function RoutineEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { routines, loaded } = useData();
  const isNew = id === 'nueva';
  const source = isNew ? null : routines.find((r) => r.id === id);

  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (draft) return;
    if (isNew) {
      const mode = params.get('modo') === 'sequential' ? 'sequential' : 'weekly';
      setDraft({
        name: '',
        mode,
        templateSessions: mode === 'sequential' ? [newSession('Sesión A', { order: 0 })] : [],
        nextSequenceIndex: 0,
      });
    } else if (source) {
      setDraft(structuredClone(source));
    }
  }, [isNew, source, draft, params]);

  if (!isNew && loaded && !source) {
    return (
      <div className="page">
        <Header title="Rutina" back="/rutinas" />
        <Empty title="Rutina no encontrada" />
      </div>
    );
  }
  if (!draft) return <div className="page"><Header title="Rutina" back="/rutinas" /></div>;

  const update = (fn) => {
    setDirty(true);
    setDraft((d) => fn(structuredClone(d)));
  };

  const sessions = draft.templateSessions;
  const valid = draft.name.trim() && sessions.length > 0;

  function save() {
    if (!valid) return;
    const data = { ...draft, name: draft.name.trim() };
    if (data.mode === 'weekly') {
      data.restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !sessions.some((s) => s.weekday === d));
    } else {
      data.templateSessions = [...sessions].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
      data.restDays = [];
    }
    if (isNew) data.active = routines.length === 0; // la primera rutina queda activa
    saveRoutine(user.uid, data);
    setDirty(false);
    navigate('/rutinas');
  }

  return (
    <div className="page has-sticky">
      <Header
        title={isNew ? 'Nueva rutina' : 'Editar rutina'}
        back={() => (!dirty || window.confirm('Hay cambios sin guardar. ¿Salir igualmente?')) && navigate('/rutinas')}
      />
      <div className="form">
        <label className="field">
          <span>Nombre de la rutina</span>
          <input value={draft.name} placeholder="Ej. Torso / Pierna" onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} />
        </label>
        <p className="muted small">
          {draft.mode === 'weekly'
            ? 'Por día de la semana: asigna una sesión a cada día o déjalo como descanso.'
            : 'Secuencial: las sesiones se hacen en orden A → B → C y vuelven a empezar.'}
        </p>
      </div>

      {draft.mode === 'weekly' ? (
        <div className="days">
          {WEEKDAYS.map((day, wd) => {
            const s = sessions.find((x) => x.weekday === wd);
            return (
              <div key={day} className={s ? 'day' : 'day rest'}>
                <div className="day-head">
                  <strong>{day}</strong>
                  {s ? (
                    <button className="btn small ghost" onClick={() => window.confirm(`¿Marcar ${day} como descanso? Se borra su sesión.`) && update((d) => ({ ...d, templateSessions: d.templateSessions.filter((x) => x.weekday !== wd) }))}>
                      Descanso
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => update((d) => ({ ...d, templateSessions: [...d.templateSessions, newSession(day, { weekday: wd })] }))}>
                      + Entreno
                    </button>
                  )}
                </div>
                {s ? <SessionEditor session={s} onChange={(fn) => update((d) => ({ ...d, templateSessions: d.templateSessions.map((x) => (x.id === s.id ? fn(x) : x)) }))} /> : <p className="muted small">Descanso</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="days">
          {[...sessions].sort((a, b) => a.order - b.order).map((s, i, arr) => (
            <div key={s.id} className="day">
              <div className="day-head">
                <strong>{sequenceLetter(i)}</strong>
                <span className="day-tools">
                  <button className="icon-btn small" disabled={i === 0} onClick={() => update((d) => swapOrder(d, arr[i - 1].id, s.id))} aria-label="Subir">↑</button>
                  <button className="icon-btn small" disabled={i === arr.length - 1} onClick={() => update((d) => swapOrder(d, s.id, arr[i + 1].id))} aria-label="Bajar">↓</button>
                  <button className="icon-btn small" onClick={() => window.confirm(`¿Eliminar la sesión ${s.name}?`) && update((d) => ({ ...d, templateSessions: d.templateSessions.filter((x) => x.id !== s.id) }))} aria-label="Eliminar">✕</button>
                </span>
              </div>
              <SessionEditor session={s} onChange={(fn) => update((d) => ({ ...d, templateSessions: d.templateSessions.map((x) => (x.id === s.id ? fn(x) : x)) }))} />
            </div>
          ))}
          <button
            className="btn wide"
            onClick={() => update((d) => ({ ...d, templateSessions: [...d.templateSessions, newSession(`Sesión ${sequenceLetter(d.templateSessions.length)}`, { order: d.templateSessions.length })] }))}
          >
            + Añadir sesión
          </button>
        </div>
      )}

      <div className="sticky-foot">
        <button className="btn primary wide" disabled={!valid} onClick={save}>
          {valid ? 'Guardar rutina' : !draft.name.trim() ? 'Ponle un nombre' : 'Añade al menos una sesión'}
        </button>
      </div>
    </div>
  );
}

function swapOrder(d, idA, idB) {
  const a = d.templateSessions.find((x) => x.id === idA);
  const b = d.templateSessions.find((x) => x.id === idB);
  [a.order, b.order] = [b.order, a.order];
  return d;
}

function SessionEditor({ session, onChange }) {
  const { profile } = useAuth();
  const { exerciseById } = useData();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(null); // item id

  const setItems = (fn) => onChange((s) => ({ ...s, items: fn(s.items) }));
  const move = (i, dir) =>
    setItems((items) => {
      const next = [...items];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  const editingItem = session.items.find((x) => x.id === editing);

  return (
    <div className="session">
      <input className="session-name" value={session.name} onChange={(e) => onChange((s) => ({ ...s, name: e.target.value }))} aria-label="Nombre de la sesión" />
      <ul className="items">
        {session.items.map((it, i) => {
          const ex = it.kind === 'strength' ? exerciseById(it.exerciseId) : null;
          return (
            <li key={it.id} className="item">
              <button className="item-main" onClick={() => setEditing(it.id)}>
                {it.kind === 'strength' ? (
                  <>
                    <span className="item-title">{ex?.name || 'Ejercicio no disponible'}</span>
                    <span className="item-sub">
                      {it.sets} × {it.repMin}–{it.repMax} · {describeLoad(it.loadKg, ex?.loadType, it.barKg)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="item-title">Cardio · {it.cardioType}</span>
                    <span className="item-sub">{cardioSummary(it)}</span>
                  </>
                )}
              </button>
              <span className="item-tools">
                <button className="icon-btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                <button className="icon-btn small" disabled={i === session.items.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="row-gap">
        <button className="btn small" onClick={() => setPicking(true)}>+ Ejercicio</button>
        <button className="btn small" onClick={() => setItems((items) => [...items, newCardioItem()])}>+ Cardio</button>
      </div>

      {picking && (
        <Modal title="Añadir ejercicio" onClose={() => setPicking(false)}>
          <ExerciseList
            onSelect={(ex) => {
              const item = newStrengthItem(ex, profile);
              setItems((items) => [...items, item]);
              setPicking(false);
              setEditing(item.id);
            }}
          />
        </Modal>
      )}

      {editingItem?.kind === 'strength' && (
        <StrengthItemEditor
          item={editingItem}
          exercise={exerciseById(editingItem.exerciseId)}
          onSave={(it) => { setItems((items) => items.map((x) => (x.id === it.id ? it : x))); setEditing(null); }}
          onDelete={() => { setItems((items) => items.filter((x) => x.id !== editingItem.id)); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
      {editingItem?.kind === 'cardio' && (
        <CardioItemEditor
          item={editingItem}
          onSave={(it) => { setItems((items) => items.map((x) => (x.id === it.id ? it : x))); setEditing(null); }}
          onDelete={() => { setItems((items) => items.filter((x) => x.id !== editingItem.id)); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
