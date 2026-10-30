import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { setActiveRoutine, deleteRoutineSoft, publishRoutine, unpublishRoutine } from '../lib/db';
import { WEEKDAYS_SHORT } from '../lib/routine';
import { Header, Modal, Empty } from '../components/ui';

export default function Routines() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { routines, loaded } = useData();
  const [choosing, setChoosing] = useState(false);
  const [sharing, setSharing] = useState(null); // rutina que se está compartiendo
  const [description, setDescription] = useState('');

  return (
    <div className="page">
      <Header
        title="Rutinas"
        action={
          <button className="icon-btn accent" onClick={() => setChoosing(true)} aria-label="Nueva rutina">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        }
      />

      {loaded && routines.length === 0 && (
        <Empty title="Todavía no tienes rutinas">
          <button className="btn primary" onClick={() => setChoosing(true)}>Crear la primera</button>
        </Empty>
      )}

      <button className="btn ghost wide" onClick={() => navigate('/rutinas/comunidad')}>Ver rutinas de la comunidad</button>

      <ul className="cards mt8">
        {routines.map((r) => (
          <li key={r.id} className={r.active ? 'card active-card' : 'card'}>
            <button className="card-main" onClick={() => navigate(`/rutinas/${r.id}`)}>
              <span className="card-title">{r.name}</span>
              <span className="muted small">
                {r.mode === 'weekly' ? 'Por día de la semana' : `Secuencial · ${r.templateSessions?.length || 0} sesiones`}
              </span>
              {r.mode === 'weekly' && (
                <span className="week-dots">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <span key={d} className={(r.templateSessions || []).some((s) => s.weekday === i) ? 'dot on' : 'dot'}>{d}</span>
                  ))}
                </span>
              )}
            </button>
            <div className="card-actions">
              {r.active ? (
                <span className="badge accent">Activa</span>
              ) : (
                <button className="btn small" onClick={() => setActiveRoutine(user.uid, routines, r.id)}>Activar</button>
              )}
              <button className="btn small ghost" onClick={() => navigate(`/rutinas/${r.id}?mejoras=1`)}>Proponer mejoras</button>
              <button className="btn small ghost" onClick={() => { setDescription(''); setSharing(r); }}>
                {r.publicId ? 'Compartida' : 'Compartir'}
              </button>
              <button
                className="btn small danger-ghost"
                onClick={() => window.confirm(`¿Eliminar la rutina "${r.name}"? El historial de sesiones se conserva.`) && deleteRoutineSoft(user.uid, r.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {choosing && (
        <Modal title="Nueva rutina" onClose={() => setChoosing(false)}>
          <button className="choice" onClick={() => navigate('/rutinas/recomendar')}>
            <strong>Recomendada para ti</strong>
            <span>Indica tu peso, altura, objetivo y días disponibles y te proponemos una rutina completa que luego puedes ajustar.</span>
          </button>
          <button className="choice" onClick={() => navigate('/rutinas/comunidad')}>
            <strong>De la comunidad</strong>
            <span>Copia una rutina que haya compartido otro usuario de la app.</span>
          </button>
          <p className="filter-label">O créala desde cero</p>
          <button className="choice" onClick={() => navigate('/rutinas/nueva?modo=weekly')}>
            <strong>Por día de la semana</strong>
            <span>Cada día tiene su sesión fija (ej. lunes pecho, miércoles pierna) y marcas los días de descanso. Si te saltas un día, la app te pregunta si eliminarlo o reorganizar la semana.</span>
          </button>
          <button className="choice" onClick={() => navigate('/rutinas/nueva?modo=sequential')}>
            <strong>Secuencial</strong>
            <span>Sesiones A → B → C en orden, sin día fijo. Siempre toca la siguiente, entrenes el día que entrenes. Ideal si tu semana es irregular.</span>
          </button>
        </Modal>
      )}

      {sharing && (
        <Modal
          title={sharing.publicId ? 'Rutina compartida' : 'Compartir con la comunidad'}
          onClose={() => setSharing(null)}
          footer={
            <>
              <button
                className="btn primary wide"
                onClick={() => {
                  publishRoutine(user, profile?.name, sharing, description);
                  setSharing(null);
                }}
              >
                {sharing.publicId ? 'Actualizar con la versión actual' : 'Compartir'}
              </button>
              {sharing.publicId && (
                <button
                  className="btn danger-ghost wide"
                  onClick={() => {
                    unpublishRoutine(user.uid, sharing);
                    setSharing(null);
                  }}
                >
                  Dejar de compartir
                </button>
              )}
            </>
          }
        >
          <p className="muted small">
            Los demás usuarios verán «{sharing.name}», sus ejercicios, series y repeticiones, y tu nombre ({profile?.name || 'sin nombre'}).
            No se comparten tus pesos, tu historial ni tus notas. Si después cambias la rutina, vuelve aquí para actualizar la copia publicada.
          </p>
          <label className="field">
            <span>Descripción (opcional)</span>
            <input value={description} maxLength={140} placeholder="Ej. 4 días, ideal para principiantes" onChange={(e) => setDescription(e.target.value)} />
          </label>
        </Modal>
      )}
    </div>
  );
}
