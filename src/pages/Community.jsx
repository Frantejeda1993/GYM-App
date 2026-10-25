import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { useData } from '../data';
import { publicRoutinesCol } from '../lib/db';
import { cloneSession } from '../lib/routine';
import { normalize } from '../lib/text';
import { Header, Modal, Empty } from '../components/ui';
import RoutinePreview from '../components/RoutinePreview';

const millis = (t) => t?.toMillis?.() ?? (Date.parse(t) || 0);
const exerciseCount = (r) => (r.templateSessions || []).reduce((a, s) => a + (s.items || []).filter((it) => it.kind === 'strength').length, 0);

// Rutinas que otros usuarios han compartido; se pueden ver y copiar a las propias.
export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exerciseById } = useData();
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        publicRoutinesCol(),
        (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt))),
        (e) => {
          console.error(e);
          setError(true);
        },
      ),
    [],
  );

  const nq = normalize(q);
  const shown = (list || []).filter((r) => !nq || normalize(`${r.name} ${r.authorName} ${r.description}`).includes(nq));

  function copy(r) {
    // Copia propia con ids nuevos; se descartan ejercicios que ya no existen en el catálogo
    const templateSessions = (r.templateSessions || []).map((s) =>
      cloneSession({ ...s, items: (s.items || []).filter((it) => it.kind !== 'strength' || exerciseById(it.exerciseId)) }),
    );
    const own = r.authorUid === user.uid;
    navigate('/rutinas/nueva', {
      state: { draft: { name: own ? `${r.name} (copia)` : `${r.name}${r.authorName ? ` · ${r.authorName}` : ''}`, mode: r.mode, templateSessions, nextSequenceIndex: 0 } },
    });
  }

  return (
    <div className="page">
      <Header title="Comunidad" back="/rutinas" />
      <p className="muted small">Rutinas que otros usuarios de la app han compartido. Ábrelas para verlas y cópialas a las tuyas para usarlas o adaptarlas.</p>
      <label className="field">
        <input value={q} placeholder="Buscar por nombre o autor" onChange={(e) => setQ(e.target.value)} />
      </label>

      {error && <p className="error">No se pudieron cargar las rutinas de la comunidad.</p>}
      {!error && list === null && <p className="muted">Cargando…</p>}
      {!error && list && shown.length === 0 && (
        <Empty title={list.length ? 'Ninguna rutina coincide' : 'Aún no hay rutinas compartidas'}>
          {!list.length && <p className="muted small">Comparte una de las tuyas desde la lista de rutinas con el botón «Compartir».</p>}
        </Empty>
      )}

      <ul className="cards mt8">
        {shown.map((r) => (
          <li key={r.id} className="card">
            <button className="card-main" onClick={() => setOpen(r)}>
              <span className="card-title">{r.name}</span>
              <span className="muted small">
                {r.authorUid === user.uid ? 'Tuya' : `de ${r.authorName || 'otro usuario'}`} · {r.mode === 'weekly' ? `${r.templateSessions?.length || 0} días por semana` : `Secuencial · ${r.templateSessions?.length || 0} sesiones`} · {exerciseCount(r)} ejercicios
              </span>
              {r.description && <span className="small">{r.description}</span>}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Modal
          title={open.name}
          onClose={() => setOpen(null)}
          footer={<button className="btn primary wide" onClick={() => copy(open)}>Copiar a mis rutinas</button>}
        >
          <p className="muted small">{open.authorUid === user.uid ? 'Compartida por ti' : `Compartida por ${open.authorName || 'otro usuario'}`}{open.description ? ` · ${open.description}` : ''}</p>
          <RoutinePreview routine={open} />
        </Modal>
      )}
    </div>
  );
}
