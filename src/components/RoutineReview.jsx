import { useState } from 'react';

const LEVELS = {
  error: { label: 'Fallo', plural: 'fallos' },
  warn: { label: 'A mejorar', plural: 'a mejorar' },
  tip: { label: 'Sugerencia', plural: 'sugerencias' },
};
const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

export function reviewSummary(review) {
  const counts = Object.keys(LEVELS).map((l) => [l, review.issues.filter((i) => i.level === l).length]).filter(([, n]) => n);
  return {
    top: counts[0]?.[0] || 'ok',
    text: counts.length ? counts.map(([l, n]) => `${n} ${n === 1 ? LEVELS[l].label.toLowerCase() : LEVELS[l].plural}`).join(' · ') : 'Sin problemas detectados',
  };
}

// Revisión en vivo de la rutina que se está editando: fallos, mejoras y volumen por músculo.
// `review` es el resultado de reviewRoutine().
export default function RoutineReview({ review, mode }) {
  const [open, setOpen] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  if (review.empty && !review.issues.length) return null;

  const summary = reviewSummary(review);

  return (
    <section className="review" id="revision">
      <button type="button" className="review-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <strong>Revisión de la rutina</strong>
          <span className={`review-sum lv-${summary.top}`}>{summary.text}</span>
        </span>
        <span className="muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          {!review.issues.length && <p className="muted small">Volumen, equilibrio y descansos están bien planteados.</p>}
          <ul className="review-list">
            {review.issues.map((i, k) => (
              <li key={k} className={`review-item lv-${i.level}`}>
                <span className="review-tag">{LEVELS[i.level].label}</span>
                <strong>{i.title}</strong>
                {i.where && <span className="muted small">{i.where}</span>}
                <p>{i.why}</p>
                <p className="review-fix"><b>Cómo mejorarlo:</b> {i.fix}</p>
              </li>
            ))}
          </ul>
          {!review.empty && (
            <>
              <button type="button" className="btn small ghost" onClick={() => setShowVolume((v) => !v)}>
                {showVolume ? 'Ocultar' : 'Ver'} series por músculo
              </button>
              {showVolume && (
                <>
                  <table className="hist delta-table">
                    <thead>
                      <tr><th>Músculo</th><th>Directas</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(review.groups).map(([g, def]) => (
                        <tr key={g}>
                          <td>{def.label}</td>
                          <td>{fmt(review.direct[g])}</td>
                          <td>{fmt(review.volume[g])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted small">
                    Series por {mode === 'weekly' ? 'semana' : 'ciclo'}. «Directas»: el músculo es el principal del ejercicio; «Total» suma también media serie cuando
                    trabaja como secundario. Referencia para ganar músculo: 10–20 por grupo.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
