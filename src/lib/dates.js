// Fechas locales en formato YYYY-MM-DD; semanas de lunes a domingo.
const pad = (n) => String(n).padStart(2, '0');

// Permite simular otra fecha en el modo de prueba: ?hoy=2026-10-15
function overrideNow() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const m = /[?&]hoy=(\d{4}-\d{2}-\d{2})/.exec(window.location.href);
  return m ? parseISODate(m[1]) : null;
}

export const now = () => overrideNow() || new Date();

export const toISODate = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

// Lunes = 0 … domingo = 6
export const weekdayIndex = (d = now()) => (d.getDay() + 6) % 7;

export const weekStart = (d = now()) => addDays(d, -weekdayIndex(d));

export const weekDates = (d = now()) => Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart(d), i)));

// Clave de semana ISO: "2026-W42"
export function isoWeekKey(d = now()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export const formatDay = (iso) =>
  parseISODate(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

export const formatWeekday = (iso) => parseISODate(iso).toLocaleDateString('es-ES', { weekday: 'long' });

// Convierte un Timestamp de Firestore (o string ISO del modo de prueba) en YYYY-MM-DD.
export function timestampToISODate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return toISODate(ts);
  if (typeof ts === 'string') return ts.slice(0, 10);
  if (typeof ts.toDate === 'function') return toISODate(ts.toDate());
  if (ts.seconds) return toISODate(new Date(ts.seconds * 1000));
  return null;
}
