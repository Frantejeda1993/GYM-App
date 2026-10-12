import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { setActiveRoutine, deleteRoutineSoft } from '../lib/db';
import { WEEKDAYS_SHORT } from '../lib/routine';
import { Header, Modal, Empty } from '../components/ui';

export default function Routines() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { routines, loaded } = useData();
  const [choosing, setChoosing] = useState(false);

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

      <ul className="cards">
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
        <Modal title="¿Cómo quieres organizarla?" onClose={() => setChoosing(false)}>
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
    </div>
  );
}
