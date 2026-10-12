import { useEffect, useRef, useState } from 'react';

let audioCtx = null;
// iOS solo permite audio tras un toque del usuario: se llama al marcar una serie.
export function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}

function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch { /* sin audio */ }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Temporizador basado en la hora de fin: sigue siendo correcto aunque la app pase a segundo plano.
export default function RestTimer({ end, total, onChange, onClose }) {
  const [nowMs, setNowMs] = useState(Date.now());
  const fired = useRef(false);
  const left = Math.max(0, Math.ceil((end - nowMs) / 1000));

  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [end]);

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      beep();
      if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [left, onClose]);

  const pct = total ? Math.min(100, ((total - left) / total) * 100) : 100;
  return (
    <div className={left === 0 ? 'rest done' : 'rest'} role="timer" aria-live="polite">
      <div className="rest-bar" style={{ width: `${pct}%` }} />
      <span className="rest-label">{left === 0 ? '¡Siguiente serie!' : 'Descanso'}</span>
      <span className="rest-time">{fmt(left)}</span>
      {left > 0 && <button className="btn small" onClick={() => onChange(end + 15000, total + 15)}>+15 s</button>}
      <button className="btn small ghost" onClick={onClose}>{left > 0 ? 'Saltar' : 'Cerrar'}</button>
    </div>
  );
}
