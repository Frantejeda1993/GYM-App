import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { saveSessionProgress, finalizeSession, discardSession, reopenSession, saveEditedSession } from '../lib/db';
import {
  sessionItems, countSets, anyMarked, computeChanges, applyChanges, defaultAccepted, defaultChoices, adhocEntry, adhocCardio,
  canSplit, splitOf, kgFromSides, lastTimeFor, templateKey,
} from '../lib/sessions';
import { describeLoad, inputToStored, storedToInput } from '../lib/load';
import { newStrengthItem, newCardioItem, CARDIO_TYPES } from '../lib/routine';
import { toISODate, now, formatDay } from '../lib/dates';
import { Header, Modal, Empty } from '../components/ui';
import ExerciseThumb from '../components/ExerciseThumb';
import ExerciseList from '../components/ExerciseList';
import RestTimer, { unlockAudio } from '../components/RestTimer';
import { ExerciseInfoModal } from '../components/ExerciseInfo';

export const FEELS = [
  { key: 'hard', label: 'Justo' },
  { key: 'ok', label: 'Bien' },
  { key: 'easy', label: 'Sobrado' },
];
const feelLabel = (k) => FEELS.find((f) => f.key === k)?.label;

export default function SessionPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { sessions, loaded } = useData();
  const remote = sessions.find((s) => s.id === id);

  if (!remote) {
    return (
      <div className="page">
        <Header title="Sesión" back="/" />
        {loaded && <Empty title="Sesión no encontrada" />}
      </div>
    );
  }
  if (remote.status !== 'in_progress') {
    if (params.get('editar') && remote.status === 'done') return <ActiveSession key={`${remote.id}-edit`} initial={remote} editMode />;
    return <SessionSummary session={remote} />;
  }
  return <ActiveSession key={remote.id} initial={remote} />;
}

// editMode: corregir una sesión ya finalizada (no toca la rutina, se guarda con un botón).
function ActiveSession({ initial, editMode = false }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { exerciseById, routineById, sessions } = useData();
  const [params] = useSearchParams();
  const [s, setS] = useState(() => ({ ...initial, entries: initial.entries || [], cardio: initial.cardio || [] }));
  const [rest, setRest] = useState(null); // { end, total }
  const [modal, setModal] = useState(params.get('finalizar') ? 'finish' : null); // 'all' | 'add' | 'finish'
  const dirty = useRef(false);
  const routine = routineById(s.routineId);

  // Guardado con pequeño retraso para no escribir en cada toque (no en modo corrección).
  useEffect(() => {
    if (editMode || !dirty.current) return undefined;
    const t = setTimeout(() => {
      saveSessionProgress(user.uid, s.id, s);
      dirty.current = false;
    }, 600);
    return () => clearTimeout(t);
  }, [s, user.uid]);
  // Al salir de la pantalla o pasar la app a segundo plano se guarda lo pendiente.
  const latest = useRef(s);
  latest.current = s;
  useEffect(() => {
    if (editMode) return undefined;
    const flush = () => {
      if (dirty.current) {
        saveSessionProgress(user.uid, latest.current.id, latest.current);
        dirty.current = false;
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [user.uid, editMode]);

  const update = useCallback((fn) => {
    dirty.current = true;
    setS((prev) => fn(structuredClone(prev)));
  }, []);

  const editEntry = (entryId, fn) => update((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entryId ? fn(e) : e)) }));
  const editCardio = (cId, fn) => update((d) => ({ ...d, cardio: d.cardio.map((c) => (c.id === cId ? fn(c) : c)) }));

  function toggleSet(entry, i) {
    unlockAudio();
    const willBeDone = !entry.sets[i].done;
    editEntry(entry.id, (e) => {
      e.sets[i].done = willBeDone;
      return e;
    });
    if (willBeDone && !editMode && entry.restSec > 0) setRest({ end: Date.now() + entry.restSec * 1000, total: entry.restSec });
  }

  const items = sessionItems(s);
  const { done, total } = countSets(s);
  const pendingCount = total - done + s.cardio.filter((c) => !c.done).length;
  const nextOrder = items.length ? Math.max(...items.map((x) => x.order ?? 0)) + 1 : 0;
  const isPast = s.date < toISODate(now());

  return (
    <div className="page session-page">
      <Header
        title={editMode ? `Corregir · ${s.sessionName || 'Sesión'}` : s.sessionName || 'Sesión'}
        back={editMode ? () => (!dirty.current || window.confirm('Hay cambios sin guardar. ¿Salir igualmente?')) && navigate(-1) : '/'}
      />
      {editMode && <p className="warn-box small">Corrigiendo la sesión del {formatDay(s.date)}. Cambia el historial y el progreso, no la rutina.</p>}
      {!editMode && isPast && <p className="warn-box small">Sesión del {formatDay(s.date)}. Revisa y finalízala; se guarda con esa fecha.</p>}

      <div className="session-top">
        <span className="muted small">{done}/{total} series</span>
        {pendingCount > 0 && <button className="btn small" onClick={() => setModal('all')}>Marcar todo como hecho</button>}
      </div>

      <div className="session-list">
        {items.map((it) =>
          it.kind === 'strength' ? (
            <StrengthCard
              key={it.id}
              entry={s.entries.find((e) => e.id === it.id)}
              exercise={exerciseById(it.exerciseId)}
              last={lastTimeFor(sessions, it.exerciseId, s)}
              onToggle={toggleSet}
              onEdit={editEntry}
              onRemove={() => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== it.id) }))}
            />
          ) : (
            <CardioCard
              key={it.id}
              item={s.cardio.find((c) => c.id === it.id)}
              onEdit={editCardio}
              onRemove={() => update((d) => ({ ...d, cardio: d.cardio.filter((c) => c.id !== it.id) }))}
            />
          ),
        )}
      </div>

      <button className="btn wide" onClick={() => setModal('add')}>+ Añadir ejercicio o cardio</button>

      <div className="session-foot">
        {rest && <RestTimer end={rest.end} total={rest.total} onChange={(end, t) => setRest({ end, total: t })} onClose={() => setRest(null)} />}
        {editMode ? (
          <button
            className="btn primary wide"
            onClick={() => {
              saveEditedSession(user.uid, s.id, s);
              dirty.current = false;
              navigate(-1);
            }}
          >
            Guardar cambios
          </button>
        ) : (
          <button className="btn primary wide" onClick={() => setModal('finish')}>Finalizar sesión</button>
        )}
      </div>

      {modal === 'all' && (
        <MarkAllModal
          session={s}
          exerciseById={exerciseById}
          onEdit={editEntry}
          onClose={() => setModal(null)}
          onConfirm={() => {
            update((d) => ({
              ...d,
              entries: d.entries.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) })),
              cardio: d.cardio.map((c) => ({ ...c, done: true })),
            }));
            setModal(null);
          }}
        />
      )}
      {modal === 'add' && (
        <AddModal
          onlyToday={editMode}
          onClose={() => setModal(null)}
          onAddExercise={(ex, fixed) => {
            const item = newStrengthItem(ex, profile);
            update((d) => ({ ...d, entries: [...d.entries, adhocEntry(item, ex, fixed, nextOrder)] }));
            setModal(null);
          }}
          onAddCardio={(fixed) => {
            update((d) => ({ ...d, cardio: [...d.cardio, adhocCardio(newCardioItem(), fixed, nextOrder)] }));
            setModal(null);
          }}
        />
      )}
      {modal === 'finish' && (
        <FinishModal
          session={{ ...s, entries: s.entries.map((e) => ({ ...e, name: exerciseById(e.exerciseId)?.displayName || e.name })) }}
          routine={routine}
          sessions={sessions}
          onClose={() => setModal(null)}
          onFinish={(changes, accepted, choices) => {
            dirty.current = false;
            const loadTypeOf = (exId) => exerciseById(exId)?.loadType;
            finalizeSession(user.uid, s, routine, routine ? applyChanges(routine, s.templateSessionId, changes, accepted, choices, loadTypeOf) : null);
            navigate('/');
          }}
          onDiscard={() => {
            dirty.current = false;
            discardSession(user.uid, s.id);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}

// Número compacto editable (kg o reps) para las filas de series.
function NumCell({ value, onChange, step, label }) {
  const [text, setText] = useState(String(value).replace('.', ','));
  useEffect(() => setText(String(value).replace('.', ',')), [value]);
  return (
    <input
      className="num-cell"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(e.target.value);
        if (raw !== '' && !raw.endsWith('.')) onChange(Number(raw));
      }}
      onBlur={() => setText(String(value).replace('.', ','))}
      step={step}
    />
  );
}

const unitOf = (lt) => (lt === 'barbell' ? 'kg/lado' : lt === 'dumbbell' ? 'kg/mano' : lt === 'bodyweight' ? '+kg' : 'kg');

function SetRow({ entry, i, onToggle, onEdit }) {
  const set = entry.sets[i];
  const lt = entry.loadType;
  const shown = storedToInput(set.kg, lt, entry.barKg);
  const changeKg = (v) =>
    onEdit(entry.id, (e) => {
      const newKg = inputToStored(v, lt, e.barKg);
      const old = e.sets[i].kg;
      e.sets[i].kg = newKg;
      // Las series siguientes sin hacer y con el mismo peso se actualizan también.
      for (let j = i + 1; j < e.sets.length; j++) if (!e.sets[j].done && e.sets[j].kg === old) e.sets[j].kg = newKg;
      return e;
    });
  // Peso distinto por mano: cada lado por separado; kg = media (mancuerna) o suma (máquina).
  const changeSide = (side) => (v) =>
    onEdit(entry.id, (e) => {
      const cur = e.sets[i];
      const old = [cur.kgL, cur.kgR].join('|');
      cur[side] = Math.max(0, Math.round(v * 100) / 100);
      cur.kg = kgFromSides(cur.kgL, cur.kgR, lt);
      for (let j = i + 1; j < e.sets.length; j++) {
        const nx = e.sets[j];
        if (!nx.done && [nx.kgL, nx.kgR].join('|') === old) Object.assign(nx, { kgL: cur.kgL, kgR: cur.kgR, kg: cur.kg });
      }
      return e;
    });
  const changeReps = (v) =>
    onEdit(entry.id, (e) => {
      e.sets[i].reps = Math.max(0, Math.round(v));
      return e;
    });
  const setFeel = (k) =>
    onEdit(entry.id, (e) => {
      e.sets[i].feel = e.sets[i].feel === k ? null : k;
      return e;
    });
  const unit = unitOf(lt);
  const split = entry.split && set.kgL != null;
  return (
    <div className="set-wrap">
      <div className={set.done ? 'set-row done' : 'set-row'}>
        <span className="set-n">{i + 1}</span>
        {split ? (
          <span className="set-field split-field">
            <NumCell value={set.kgL} onChange={changeSide('kgL')} label={`Serie ${i + 1} izquierda kg`} />
            <span className="split-sep">I · D</span>
            <NumCell value={set.kgR} onChange={changeSide('kgR')} label={`Serie ${i + 1} derecha kg`} />
          </span>
        ) : (
          <label className="set-field">
            <NumCell value={shown} onChange={changeKg} label={`Serie ${i + 1} ${unit}`} />
            <span>{unit}</span>
          </label>
        )}
        <label className="set-field">
          <NumCell value={set.reps} onChange={changeReps} label={`Serie ${i + 1} reps`} />
          <span>reps</span>
        </label>
        <button className="set-check" onClick={() => onToggle(entry, i)} aria-label={set.done ? `Desmarcar serie ${i + 1}` : `Marcar serie ${i + 1}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </button>
      </div>
      {set.done && (
        <div className="feel-row" role="group" aria-label={`Cómo fue la serie ${i + 1}`}>
          {FEELS.map((f) => (
            <button key={f.key} className={set.feel === f.key ? `feel on feel-${f.key}` : 'feel'} onClick={() => setFeel(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// "Última vez": series hechas de la sesión anterior con este ejercicio, con su sensación.
function LastTime({ last, loadType, barKg }) {
  if (!last) return <p className="last-time muted">Primera vez con este ejercicio.</p>;
  const sets = last.entry.sets.filter((x) => x.done);
  const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
  const day = new Date(`${last.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return (
    <p className="last-time">
      <span className="muted">Última vez · {day} ({unitOf(loadType)}):</span>{' '}
      {sets.map((x, i) => (
        <span key={i} className="last-set">
          {x.kgL != null && last.entry.split ? `${fmt(x.kgL)}/${fmt(x.kgR)}` : fmt(storedToInput(x.kg, loadType, barKg))}×{x.reps}
          {x.feel && <em className={`feel-tag feel-${x.feel}`}>{feelLabel(x.feel)}</em>}
        </span>
      ))}
    </p>
  );
}

function StrengthCard({ entry, exercise, last, onToggle, onEdit, onRemove }) {
  const [info, setInfo] = useState(false);
  if (!entry) return null;
  const allDone = entry.sets.length > 0 && entry.sets.every((x) => x.done);
  const planned = entry.sets[0];
  const toggleSplit = () =>
    onEdit(entry.id, (e) => {
      e.split = !e.split;
      e.sets = e.sets.map((x) => {
        if (e.split) return { ...x, ...splitOf(x.kg, e.loadType) };
        const { kgL, kgR, ...rest } = x; // eslint-disable-line no-unused-vars
        return rest;
      });
      return e;
    });
  return (
    <section className={allDone ? 'ex-card all-done' : 'ex-card'}>
      <div className="ex-head">
        <ExerciseThumb exercise={exercise || { name: entry.name }} size={52} />
        <div className="row-text">
          <span className="row-title">
            {exercise?.displayName || entry.name}
            {entry.adhoc && <span className="badge">{entry.fixed ? 'nuevo fijo' : 'solo hoy'}</span>}
          </span>
          <span className="row-sub">
            Rango {entry.repMin}–{entry.repMax} · {planned ? describeLoad(planned.plannedKg, entry.loadType, entry.barKg) : ''}
          </span>
        </div>
        {exercise && (
          <button className="icon-btn info-btn" onClick={() => setInfo(true)} aria-label="Ficha, vídeos y notas">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
          </button>
        )}
      </div>
      <LastTime last={last} loadType={entry.loadType} barKg={entry.barKg} />
      {exercise?.notes && (
        <button className="notes-line" onClick={() => setInfo(true)}>📝 {exercise.notes}</button>
      )}
      {info && exercise && <ExerciseInfoModal exercise={exercise} onClose={() => setInfo(false)} />}
      {entry.sets.map((_, i) => (
        <SetRow key={i} entry={entry} i={i} onToggle={onToggle} onEdit={onEdit} />
      ))}
      <div className="ex-tools">
        <button
          className="btn small ghost"
          onClick={() =>
            onEdit(entry.id, (e) => {
              const last = e.sets[e.sets.length - 1] || { plannedKg: 0, plannedReps: e.repMin, kg: 0, reps: e.repMin };
              const nx = { plannedKg: last.kg, plannedReps: last.reps, kg: last.kg, reps: last.reps, done: false, feel: null };
              if (e.split) Object.assign(nx, last.kgL != null ? { kgL: last.kgL, kgR: last.kgR } : splitOf(last.kg, e.loadType));
              e.sets.push(nx);
              return e;
            })
          }
        >
          + Serie
        </button>
        <button
          className="btn small ghost"
          disabled={!entry.sets.length || entry.sets[entry.sets.length - 1].done}
          onClick={() => onEdit(entry.id, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
        >
          − Serie
        </button>
        {canSplit(entry.loadType) && (
          <button className={entry.split ? 'btn small split-on' : 'btn small ghost'} onClick={toggleSplit} aria-pressed={!!entry.split}>
            {entry.loadType === 'dumbbell' ? 'Por mano' : 'Por lado'}
          </button>
        )}
        {entry.adhoc && <button className="btn small danger-ghost" onClick={onRemove}>Quitar</button>}
      </div>
    </section>
  );
}

function CardioCard({ item, onEdit, onRemove }) {
  if (!item) return null;
  const setField = (k) => (v) => onEdit(item.id, (c) => ({ ...c, [k]: v === '' ? null : v }));
  return (
    <section className={item.done ? 'ex-card all-done' : 'ex-card'}>
      <div className="ex-head">
        <span className="thumb thumb-empty" style={{ width: 52, height: 52 }}>♥</span>
        <div className="row-text">
          <span className="row-title">
            Cardio
            {item.adhoc && <span className="badge">{item.fixed ? 'nuevo fijo' : 'solo hoy'}</span>}
          </span>
          <select className="cardio-type" value={item.cardioType} onChange={(e) => onEdit(item.id, (c) => ({ ...c, cardioType: e.target.value }))}>
            {CARDIO_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className={item.done ? 'set-row done cardio-row' : 'set-row cardio-row'}>
        <label className="set-field"><NumCell value={item.minutes ?? ''} onChange={setField('minutes')} label="Minutos" /><span>min</span></label>
        <label className="set-field"><NumCell value={item.steps ?? ''} onChange={setField('steps')} label="Pasos" /><span>pasos</span></label>
        <label className="set-field"><NumCell value={item.kcal ?? ''} onChange={setField('kcal')} label="Calorías" /><span>kcal</span></label>
        <button className="set-check" onClick={() => { unlockAudio(); onEdit(item.id, (c) => ({ ...c, done: !c.done })); }} aria-label={item.done ? 'Desmarcar cardio' : 'Marcar cardio'}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </button>
      </div>
      {item.adhoc && <div className="ex-tools"><button className="btn small danger-ghost" onClick={onRemove}>Quitar</button></div>}
    </section>
  );
}

function MarkAllModal({ session, exerciseById, onEdit, onClose, onConfirm }) {
  const pending = session.entries.filter((e) => e.sets.some((x) => !x.done));
  const cardio = session.cardio.filter((c) => !c.done);
  return (
    <Modal
      title="Confirmar todo"
      onClose={onClose}
      footer={<button className="btn primary wide" onClick={onConfirm}>Confirmar y marcar todo</button>}
    >
      <p className="muted small">Revisa series, pesos y repeticiones. Corrige lo que no coincida antes de confirmar.</p>
      {pending.map((e) => (
        <div key={e.id} className="confirm-block">
          <p className="row-title">{exerciseById(e.exerciseId)?.displayName || e.name}</p>
          {e.sets.map((x, i) => (x.done ? null : <SetRow key={i} entry={e} i={i} onToggle={() => {}} onEdit={onEdit} />))}
        </div>
      ))}
      {cardio.map((c) => (
        <p key={c.id} className="row-title">Cardio · {c.cardioType} <span className="muted small">{[c.minutes && `${c.minutes} min`, c.steps && `${c.steps} pasos`, c.kcal && `${c.kcal} kcal`].filter(Boolean).join(' · ')}</span></p>
      ))}
    </Modal>
  );
}

function AddModal({ onClose, onAddExercise, onAddCardio, onlyToday }) {
  const [step, setStep] = useState('kind'); // kind | pick | scope
  const [pending, setPending] = useState(null); // { type, exercise }
  return (
    <Modal title={step === 'scope' ? '¿Solo hoy o fijo?' : 'Añadir'} onClose={onClose}>
      {step === 'kind' && (
        <>
          <button className="choice" onClick={() => setStep('pick')}><strong>Ejercicio</strong><span>Del catálogo o creado por usuarios.</span></button>
          <button className="choice" onClick={() => (onlyToday ? onAddCardio(false) : (setPending({ type: 'cardio' }), setStep('scope')))}><strong>Cardio</strong><span>Cinta, bici, elíptica…</span></button>
        </>
      )}
      {step === 'pick' && <ExerciseList onSelect={(ex) => (onlyToday ? onAddExercise(ex, false) : (setPending({ type: 'exercise', exercise: ex }), setStep('scope')))} />}
      {step === 'scope' && (
        <>
          {pending.exercise && <p className="row-title">{pending.exercise.displayName}</p>}
          <button className="choice" onClick={() => (pending.type === 'cardio' ? onAddCardio(false) : onAddExercise(pending.exercise, false))}>
            <strong>Solo hoy</strong><span>No cambia la rutina.</span>
          </button>
          <button className="choice" onClick={() => (pending.type === 'cardio' ? onAddCardio(true) : onAddExercise(pending.exercise, true))}>
            <strong>Fijo</strong><span>Se añade a esta sesión de la rutina a partir de la próxima vez.</span>
          </button>
        </>
      )}
    </Modal>
  );
}

function FinishModal({ session, routine, sessions, onClose, onFinish, onDiscard }) {
  const { done, total } = countSets(session);
  const cardioPending = session.cardio.filter((c) => !c.done).length;
  const changes = useMemo(() => computeChanges(session, routine, describeLoad, sessions), [session, routine, sessions]);
  const [accepted, setAccepted] = useState(() => defaultAccepted(changes));
  const [choices, setChoices] = useState(() => defaultChoices(changes));
  const toggle = (id) => setAccepted((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marked = anyMarked(session);
  const progression = changes.filter((c) => c.kind === 'progression');
  const mixed = changes.filter((c) => c.kind === 'mixed');
  const ups = changes.filter((c) => (c.kind === 'update' || c.kind === 'add') && !c.down);
  const downs = changes.filter((c) => c.kind === 'update' && c.down);
  // Ejercicios que también están en otros días: reciben la misma subida/bajada de peso.
  const linked = [...new Map(changes.filter((c) => c.alsoIn?.length).map((c) => [c.itemId, c])).values()];

  const Toggle = ({ c }) => (
    <label className="toggle-row">
      <input type="checkbox" checked={accepted.has(c.id)} onChange={() => toggle(c.id)} />
      <span><strong>{c.label}:</strong> {c.detail}</span>
    </label>
  );

  return (
    <Modal
      title="Finalizar sesión"
      onClose={onClose}
      footer={
        marked ? (
          <button className="btn primary wide" onClick={() => onFinish(changes, accepted, choices)}>Finalizar</button>
        ) : (
          <button className="btn danger-ghost wide" onClick={onDiscard}>Descartar sesión</button>
        )
      }
    >
      {!marked ? (
        <p>No has marcado ninguna serie. Puedes descartar la sesión (cuenta como no realizada) o volver y marcar lo que hiciste.</p>
      ) : (
        <>
          <p><strong>{done} de {total}</strong> series hechas.</p>
          {(total - done > 0 || cardioPending > 0) && (
            <p className="warn-box small">
              {total - done > 0 && `${total - done} series sin marcar`}
              {total - done > 0 && cardioPending > 0 && ' y '}
              {cardioPending > 0 && `${cardioPending} cardio sin marcar`} quedarán como no realizados.
            </p>
          )}
          {mixed.map((c) => (
            <div key={c.id} className="change-block mixed">
              <p className="filter-label">{c.label}</p>
              <p className="small">{c.detail} ¿Qué guardo para la próxima vez?</p>
              {c.options.map((o) => (
                <label key={o.key} className="toggle-row">
                  <input type="radio" name={c.id} checked={(choices[c.id] || 'progressive') === o.key} onChange={() => setChoices((x) => ({ ...x, [c.id]: o.key }))} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          ))}
          {progression.length > 0 && (
            <div className="change-block progression">
              <p className="filter-label">Progresión de carga</p>
              {progression.map((c) => <Toggle key={c.id} c={c} />)}
            </div>
          )}
          {ups.length > 0 && (
            <div className="change-block">
              <p className="filter-label">Se actualiza en la rutina</p>
              <ul className="plain-list">
                {ups.map((c) => <li key={c.id}><strong>{c.label}:</strong> {c.detail}</li>)}
              </ul>
            </div>
          )}
          {downs.length > 0 && (
            <div className="change-block">
              <p className="filter-label">Bajó respecto al plan · ¿actualizar la rutina?</p>
              {downs.map((c) => <Toggle key={c.id} c={c} />)}
              <p className="muted small">Si no lo marcas, la rutina mantiene el valor anterior.</p>
            </div>
          )}
          {linked.length > 0 && (
            <div className="change-block">
              <p className="muted small">
                Si cambia el peso, se aplica la misma subida o bajada en los otros días con ese ejercicio:{' '}
                {linked.map((c) => `${c.label.split(' · serie')[0]} (${c.alsoIn.join(', ')})`).join('; ')}.
              </p>
            </div>
          )}
          {!changes.length && <p className="muted small">Sin cambios en la rutina.</p>}
          <p className="muted small">Podrás reabrirla hoy o corregirla más tarde desde Progreso → Historial.</p>
        </>
      )}
    </Modal>
  );
}

function SessionSummary({ session }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { routineById, sessions } = useData();
  const items = sessionItems(session);
  const isToday = session.date === toISODate(now());
  const otherOpen = sessions.some((x) => x.status === 'in_progress' && x.id !== session.id);
  const routine = routineById(session.routineId);
  const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

  function reopen() {
    if (otherOpen) {
      window.alert('Ya tienes otra sesión en curso. Finalízala o descártala antes de reabrir esta.');
      return;
    }
    const u = session.undo;
    const canRevert = u && routine && templateKey(routine.templateSessions) === u.afterKey && (routine.nextSequenceIndex ?? 0) === u.afterNext;
    const msg = !u
      ? 'La sesión vuelve a estar en curso. Al finalizarla de nuevo se recalculan los cambios en la rutina.'
      : canRevert
        ? 'La sesión vuelve a estar en curso y se deshacen los cambios que aplicó en la rutina (pesos, progresión). Al finalizarla de nuevo se recalculan.'
        : 'La rutina ha cambiado desde que finalizaste: no se pueden deshacer automáticamente los cambios que aplicó. Al volver a finalizar, revisa que no se suba el peso dos veces.';
    if (!window.confirm(`${msg}\n\n¿Reabrir?`)) return;
    reopenSession(user.uid, session, routine);
  }

  return (
    <div className="page">
      <Header title={session.sessionName || 'Sesión'} back={-1} />
      <p className="muted">{formatDay(session.date)} · {session.status === 'done' ? 'Finalizada' : 'No realizada'}{session.editedAt ? ' · corregida' : ''}</p>
      {session.status === 'done' && (
        <div className="row-gap mb12">
          <button className="btn small" onClick={() => navigate(`/sesion/${session.id}?editar=1`)}>Corregir</button>
          {isToday && <button className="btn small" onClick={reopen}>Reabrir</button>}
        </div>
      )}
      {items.map((it) =>
        it.kind === 'strength' ? (
          <div key={it.id} className="card">
            <p className="row-title">{it.name}</p>
            {it.sets.map((x, i) => (
              <p key={i} className={x.done ? 'small' : 'small muted'}>
                {i + 1}. {it.split && x.kgL != null ? `${fmt(x.kgL)} / ${fmt(x.kgR)} kg (izq. / der.)` : describeLoad(x.kg, it.loadType, it.barKg)} × {x.reps}{' '}
                {x.done ? '✓' : '(no hecha)'}
                {x.feel && <em className={`feel-tag feel-${x.feel}`}>{feelLabel(x.feel)}</em>}
              </p>
            ))}
          </div>
        ) : (
          <div key={it.id} className="card">
            <p className="row-title">Cardio · {it.cardioType} {it.done ? '✓' : '(no hecho)'}</p>
          </div>
        ),
      )}
    </div>
  );
}
