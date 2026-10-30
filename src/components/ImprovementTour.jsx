import { useState } from 'react';
import { Modal } from './ui';

const LEVEL = { error: 'Fallo', warn: 'A mejorar', tip: 'Sugerencia' };

// Tour paso a paso por las mejoras propuestas para toda la rutina.
// steps: de proposeImprovements(). onApply(step) aplica el cambio al borrador; onIgnore(step) lo descarta para siempre.
export default function ImprovementTour({ steps, onApply, onIgnore, onClose }) {
  const [i, setI] = useState(0);
  const [log, setLog] = useState({}); // key → 'applied' | 'ignored' | 'later'
  const step = steps[i];
  const next = (key, result) => {
    setLog((l) => ({ ...l, [key]: result }));
    setI((x) => x + 1);
  };

  if (!steps.length) {
    return (
      <Modal title="Proponer mejoras" onClose={onClose} footer={<button className="btn primary wide" onClick={onClose}>Cerrar</button>}>
        <p>No hay mejoras pendientes para esta rutina: volumen, equilibrio, orden y descansos están bien planteados (o ya decidiste ignorar lo que quedaba).</p>
      </Modal>
    );
  }

  if (!step) {
    const count = (v) => Object.values(log).filter((x) => x === v).length;
    return (
      <Modal title="Mejoras revisadas" onClose={onClose} footer={<button className="btn primary wide" onClick={onClose}>Volver a la rutina</button>}>
        <ul className="plain-list">
          <li><strong>{count('applied')}</strong> aplicadas</li>
          <li><strong>{count('ignored')}</strong> ignoradas (no se volverán a proponer)</li>
          <li><strong>{count('later')}</strong> para más adelante</li>
        </ul>
        {count('applied') > 0 && <p className="warn-box small">Los cambios aplicados están en la rutina pero no se guardan hasta que pulses «Guardar rutina».</p>}
      </Modal>
    );
  }

  return (
    <Modal
      title={`Mejora ${i + 1} de ${steps.length}`}
      onClose={onClose}
      footer={
        <div className="tour-foot">
          <button className="btn ghost" onClick={() => { onIgnore(step); next(step.key, 'ignored'); }}>Ignorar</button>
          <button className="btn ghost" onClick={() => next(step.key, 'later')}>Ahora no</button>
          {step.apply && <button className="btn primary" onClick={() => { onApply(step); next(step.key, 'applied'); }}>Aplicar</button>}
        </div>
      }
    >
      <div className="tour-progress" aria-hidden="true"><span style={{ width: `${(i / steps.length) * 100}%` }} /></div>
      <span className={`review-tag lv-${step.level}`}>{LEVEL[step.level]}</span>
      <h3 className="tour-title">{step.title}</h3>
      <p>{step.why}</p>
      {step.places?.length > 0 && (
        <>
          <p className="filter-label">Dónde</p>
          <ul className="plain-list small">{step.places.map((p, k) => <li key={k}>{p}</li>)}</ul>
        </>
      )}
      <p className="review-fix"><b>{step.apply ? 'Propuesta:' : 'Cómo mejorarlo:'}</b> {step.fix}</p>
      {!step.apply && <p className="muted small">Este cambio no se puede aplicar automáticamente. «Ignorar» lo oculta para siempre; «Ahora no», solo esta vez.</p>}
    </Modal>
  );
}
