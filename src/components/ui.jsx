import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Header({ title, back, action }) {
  const navigate = useNavigate();
  return (
    <header className="header">
      {back ? (
        <button className="icon-btn" onClick={() => (typeof back === 'function' ? back() : typeof back === 'string' ? navigate(back) : navigate(-1))} aria-label="Volver">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      ) : (
        <span className="icon-btn-spacer" />
      )}
      <h1>{title}</h1>
      {action || <span className="icon-btn-spacer" />}
    </header>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Campo numérico con botones − / + (cómodo con una mano en el gimnasio).
export function Stepper({ label, value, onChange, step = 1, min = 0, max, suffix, allowEmpty }) {
  const num = value === '' || value == null ? '' : Number(value);
  // Texto mientras se escribe: permite estados intermedios como "80," o "80,0" sin que el formateo los borre.
  const [text, setText] = useState(null);
  const clamp = (v) => {
    let n = Math.round(v * 100) / 100;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  };
  return (
    <label className="stepper">
      {label && <span className="stepper-label">{label}{suffix ? ` (${suffix})` : ''}</span>}
      <div className="stepper-row">
        <button type="button" onClick={() => { setText(null); onChange(clamp((Number(num) || 0) - step)); }} aria-label={`Restar ${label || ''}`}>−</button>
        <input
          inputMode="decimal"
          value={text ?? (num === '' || Number.isNaN(num) ? '' : String(num).replace('.', ','))}
          placeholder={allowEmpty ? '—' : '0'}
          onChange={(e) => {
            const t = e.target.value;
            const raw = t.replace(',', '.');
            if (raw === '') {
              setText('');
              return onChange(allowEmpty ? '' : 0);
            }
            if (!/^\d*\.?\d*$/.test(raw)) return;
            setText(t);
            if (raw !== '.') onChange(clamp(Number(raw)));
          }}
          onBlur={() => setText(null)}
        />
        <button type="button" onClick={() => { setText(null); onChange(clamp((Number(num) || 0) + step)); }} aria-label={`Sumar ${label || ''}`}>+</button>
      </div>
    </label>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}
