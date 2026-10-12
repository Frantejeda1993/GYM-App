import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { sequenceLetter, cardioSummary, setsLabel, WEEKDAYS } from '../lib/routine';
import { describeLoad, describeItemLoad } from '../lib/load';
import { toISODate, now, formatDay, weekdayIndex } from '../lib/dates';
import {
  plannedSessionFor, missedDays, buildSession, orderedSessions, anyMarked, countSets,
  proposeReorganization,
} from '../lib/sessions';
import { startSession, discardSession, skipMissedDays, applyReorganization } from '../lib/db';
import { Header, Empty, Modal } from '../components/ui';
import ExerciseThumb from '../components/ExerciseThumb';
import { daysSinceWeight } from '../lib/body';

export default function Today() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeRoutine, exerciseById, loaded, sessions, weekOverride, bodyMetrics } = useData();
  const [choosing, setChoosing] = useState(false);
  const [reorganizing, setReorganizing] = useState(false);

  const today = toISODate(now());
  const inProgress = sessions.find((s) => s.status === 'in_progress');
  const stale = inProgress && inProgress.date < today ? inProgress : null;
  const missed = useMemo(
    () => (loaded && !inProgress ? missedDays(activeRoutine, weekOverride, sessions) : []),
    [loaded, inProgress, activeRoutine, weekOverride, sessions],
  );
  const doneToday = sessions.filter((s) => s.date === today && s.status === 'done');
  const planned = plannedSessionFor(activeRoutine, weekOverride);
  const plannedDone = planned && doneToday.some((s) => s.templateSessionId === planned.id && s.routineId === activeRoutine.id);

  function start(templateSession) {
    const data = buildSession(activeRoutine, templateSession, exerciseById);
    const id = startSession(user.uid, data);
    navigate(`/sesion/${id}`);
  }

  const sinceWeight = daysSinceWeight(bodyMetrics, today);
  const [weighDismissed, setWeighDismissed] = useState(() => {
    try { return localStorage.getItem('weigh-dismissed') === today; } catch { return false; }
  });
  const showWeigh = loaded && !weighDismissed && (sinceWeight == null || sinceWeight > (profile?.weighReminderDays ?? 14));

  if (!loaded) return <div className="page"><Header title={`Hola, ${profile?.name || ''}`} /></div>;

  return (
    <div className="page">
      <Header title={`Hola, ${profile?.name || ''}`} />

      {showWeigh && (
        <div className="weigh-banner" role="status">
          <span>{sinceWeight == null ? 'Aún no has registrado tu peso.' : `Hace ${sinceWeight} días que no registras tu peso.`}</span>
          <button className="btn small primary" onClick={() => navigate('/cuerpo/nuevo')}>Registrar</button>
          <button
            className="icon-btn small"
            aria-label="Ocultar hoy"
            onClick={() => {
              try { localStorage.setItem('weigh-dismissed', today); } catch { /* sin almacenamiento */ }
              setWeighDismissed(true);
            }}
          >✕</button>
        </div>
      )}

      {!activeRoutine && !inProgress && (
        <Empty title="No tienes una rutina activa">
          <Link className="btn primary" to="/rutinas">Crear rutina</Link>
        </Empty>
      )}

      {inProgress && !stale && (
        <div className="card active-card">
          <p className="eyebrow">Sesión en curso</p>
          <h2 className="card-title">{inProgress.sessionName}</h2>
          <p className="muted small">{countSets(inProgress).done} de {countSets(inProgress).total} series hechas</p>
          <button className="btn primary wide" onClick={() => navigate(`/sesion/${inProgress.id}`)}>Continuar</button>
        </div>
      )}

      {activeRoutine && !inProgress && (
        <>
          {doneToday.length > 0 && (
            <div className="card done-card">
              <p className="eyebrow">Hecho hoy</p>
              {doneToday.map((s) => (
                <p key={s.id} className="done-line">✓ {s.sessionName} <span className="muted small">· {countSets(s).done} series</span></p>
              ))}
            </div>
          )}
          <PlannedCard
            routine={activeRoutine}
            session={plannedDone ? null : planned}
            restDay={!planned}
            exerciseById={exerciseById}
            onStart={start}
            onChoose={() => setChoosing(true)}
            doneAlready={plannedDone}
          />
        </>
      )}

      {choosing && (
        <Modal title="Elegir sesión" onClose={() => setChoosing(false)}>
          {orderedSessions(activeRoutine).map((s, i) => (
            <button key={s.id} className="choice" onClick={() => { setChoosing(false); start(s); }}>
              <strong>
                {activeRoutine.mode === 'sequential' ? `${sequenceLetter(i)} · ` : s.weekday != null ? `${WEEKDAYS[s.weekday]} · ` : ''}
                {s.name}
              </strong>
              <span>{s.items.length} ejercicios</span>
            </button>
          ))}
        </Modal>
      )}

      {stale && <UnfinishedModal session={stale} user={user} navigate={navigate} />}

      {!stale && missed.length > 0 && !reorganizing && (
        <MissedModal
          routine={activeRoutine}
          missed={missed}
          onSkip={() => skipMissedDays(user.uid, activeRoutine, missed)}
          onReorganize={() => setReorganizing(true)}
        />
      )}
      {!stale && missed.length > 0 && reorganizing && (
        <ReorganizeModal
          routine={activeRoutine}
          override={weekOverride}
          missed={missed}
          onCancel={() => setReorganizing(false)}
          onApply={(assignments, leftover, permanent) => {
            applyReorganization(user.uid, activeRoutine, weekOverride, missed, assignments, leftover, permanent);
            setReorganizing(false);
          }}
        />
      )}
    </div>
  );
}

function PlannedCard({ routine, session, restDay, exerciseById, onStart, onChoose, doneAlready }) {
  const title = routine.mode === 'weekly' ? WEEKDAYS[weekdayIndex(now())] : 'Siguiente en la secuencia';
  return (
    <div className="card">
      <p className="eyebrow">{title} · {routine.name}</p>
      {session ? (
        <>
          <h2 className="card-title">
            {routine.mode === 'sequential' && `${sequenceLetter(routine.nextSequenceIndex || 0)} · `}
            {session.name}
          </h2>
          <ul className="today-list">
            {session.items.map((it) => {
              if (it.kind === 'cardio') {
                return (
                  <li key={it.id} className="today-item">
                    <span className="thumb thumb-empty" style={{ width: 48, height: 48 }}>♥</span>
                    <span className="row-text">
                      <span className="row-title">Cardio · {it.cardioType}</span>
                      <span className="row-sub">{cardioSummary(it)}</span>
                    </span>
                  </li>
                );
              }
              const ex = exerciseById(it.exerciseId);
              return (
                <li key={it.id} className="today-item">
                  <ExerciseThumb exercise={ex} size={48} />
                  <span className="row-text">
                    <span className="row-title">{ex?.name || 'Ejercicio'}</span>
                    <span className="row-sub">{setsLabel(it)} · {describeItemLoad(it, ex?.loadType)}</span>
                  </span>
                </li>
              );
            })}
            {session.items.length === 0 && <li className="muted">Sesión sin ejercicios todavía.</li>}
          </ul>
          <button className="btn primary wide" disabled={!session.items.length} onClick={() => onStart(session)}>Iniciar sesión</button>
        </>
      ) : (
        <p className="muted">{doneAlready ? 'Ya completaste la sesión de hoy.' : restDay ? 'Hoy es día de descanso.' : ''}</p>
      )}
      <button className="btn ghost wide mt8" onClick={onChoose}>{session ? 'Elegir otra sesión' : 'Entrenar igualmente'}</button>
    </div>
  );
}

function UnfinishedModal({ session, user, navigate }) {
  const marked = anyMarked(session);
  const { done, total } = countSets(session);
  return (
    <Modal title="Sesión sin finalizar">
      <p>
        La sesión <strong>{session.sessionName}</strong> del {formatDay(session.date)} quedó abierta
        ({done} de {total} series marcadas).
      </p>
      {marked && (
        <button
          className="choice"
          onClick={() => navigate(`/sesion/${session.id}?finalizar=1`)}
        >
          <strong>Finalizar con lo marcado</strong>
          <span>Las series sin marcar quedan como no realizadas. Se guarda con su fecha original; antes ves los cambios en la rutina.</span>
        </button>
      )}
      <button className="choice" onClick={() => navigate(`/sesion/${session.id}`)}>
        <strong>Revisar antes de finalizar</strong>
        <span>Abre la sesión para marcar o corregir series y después finalizarla.</span>
      </button>
      {!marked && (
        <button className="choice" onClick={() => discardSession(user.uid, session.id)}>
          <strong>Descartar</strong>
          <span>No marcaste nada: cuenta como no realizada.</span>
        </button>
      )}
    </Modal>
  );
}

function MissedModal({ routine, missed, onSkip, onReorganize }) {
  const name = (id) => routine.templateSessions.find((s) => s.id === id)?.name || 'Sesión';
  return (
    <Modal title={missed.length > 1 ? 'Días sin entrenar' : 'Día sin entrenar'}>
      <p>No registraste {missed.length > 1 ? 'estas sesiones' : 'esta sesión'} de la semana:</p>
      <ul className="plain-list">
        {missed.map((m) => (
          <li key={m.date}><strong>{formatDay(m.date)}</strong> · {name(m.templateSessionId)}</li>
        ))}
      </ul>
      <button className="choice" onClick={onSkip}>
        <strong>Eliminar {missed.length > 1 ? 'esos días' : 'ese día'}</strong>
        <span>Quedan como no realizados. Hoy sigue lo planificado.</span>
      </button>
      <button className="choice" onClick={onReorganize}>
        <strong>Reorganizar la semana</strong>
        <span>Tú decides qué sesión hacer cada día que queda, incluida la perdida.</span>
      </button>
    </Modal>
  );
}

function ReorganizeModal({ routine, override, missed, onCancel, onApply }) {
  const proposal = useMemo(() => proposeReorganization(routine, override, missed), [routine, override, missed]);
  const [assignments, setAssignments] = useState(proposal.assignments);
  const [step, setStep] = useState('assign');
  const name = (id) => routine.templateSessions.find((s) => s.id === id)?.name || 'Sesión';
  const pool = [...new Set(proposal.pool)];
  const chosen = Object.values(assignments).filter(Boolean);
  const leftover = pool.filter((id) => !chosen.includes(id));
  const repeated = chosen.filter((id, i) => chosen.indexOf(id) !== i);

  return (
    <Modal title="Reorganizar la semana" onClose={onCancel}>
      {step === 'assign' ? (
        <>
          <p className="muted small">Elige qué sesión haces cada día que queda. Nada se cambia hasta que confirmes.</p>
          <div className="reorg">
            {proposal.remaining.map((d) => (
              <label key={d} className="reorg-row">
                <span className="reorg-day">{formatDay(d)}{d === toISODate(now()) ? ' (hoy)' : ''}</span>
                <select value={assignments[d] || ''} onChange={(e) => setAssignments({ ...assignments, [d]: e.target.value || null })}>
                  <option value="">Descanso</option>
                  {pool.map((id) => <option key={id} value={id}>{name(id)}</option>)}
                </select>
              </label>
            ))}
          </div>
          {leftover.length > 0 && (
            <p className="warn-box small">No caben: {leftover.map(name).join(', ')}. Quedarán como no realizadas esta semana.</p>
          )}
          {repeated.length > 0 && <p className="muted small">Ojo: {[...new Set(repeated)].map(name).join(', ')} aparece más de una vez.</p>}
          <button className="btn primary wide mt8" onClick={() => setStep('scope')}>Continuar</button>
        </>
      ) : (
        <>
          <p>¿Este cambio es excepcional o permanente?</p>
          <button className="choice" onClick={() => onApply(assignments, leftover, false)}>
            <strong>Solo esta semana</strong>
            <span>La próxima semana vuelve el plan habitual.</span>
          </button>
          <button className="choice" disabled={leftover.length > 0} onClick={() => onApply(assignments, leftover, true)}>
            <strong>Permanente</strong>
            <span>
              {leftover.length > 0
                ? 'No disponible: todas las sesiones deben tener un día.'
                : 'Las sesiones cambian de día en la rutina a partir de ahora.'}
            </span>
          </button>
          <button className="btn ghost wide" onClick={() => setStep('assign')}>Volver</button>
        </>
      )}
    </Modal>
  );
}
