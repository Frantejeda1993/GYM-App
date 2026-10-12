import { parseISODate } from './dates';

export const METHODS = {
  bia: 'Báscula de bioimpedancia',
  caliper: 'Plicómetro',
  dexa: 'DEXA',
  other: 'Otro',
};

export const METRICS = {
  weight: { label: 'Peso', short: 'Peso' },
  fat: { label: 'Grasa', short: 'Grasa' },
  muscle: { label: 'Músculo', short: 'Músculo' },
  water: { label: 'Agua', short: 'Agua' },
};

const DAY = 86400000;

// Combinaciones comparables (método + unidad) con datos para una métrica.
// El peso siempre es comparable entre sí.
export function combosFor(entries, metric) {
  if (metric === 'weight') return entries.some((e) => e.weightKg > 0) ? [{ key: 'weight', method: null, unit: 'kg' }] : [];
  const map = new Map();
  entries.forEach((e) => {
    const m = e[metric];
    if (m?.value > 0) {
      const key = `${e.method}|${m.unit}`;
      if (!map.has(key)) map.set(key, { key, method: e.method, unit: m.unit, count: 0, last: e.date });
      const c = map.get(key);
      c.count += 1;
      if (e.date > c.last) c.last = e.date;
    }
  });
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

// Serie ordenada por fecha con media móvil de 7 días (mediciones de esa fecha y los 6 días previos).
export function series(entries, metric, combo) {
  const pts = entries
    .filter((e) => (metric === 'weight' ? e.weightKg > 0 : e[metric]?.value > 0 && `${e.method}|${e[metric].unit}` === combo.key))
    .map((e) => ({ id: e.id, date: e.date, value: metric === 'weight' ? e.weightKg : e[metric].value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return pts.map((p) => {
    const t = parseISODate(p.date).getTime();
    const win = pts.filter((q) => {
      const tq = parseISODate(q.date).getTime();
      return tq <= t && tq > t - 7 * DAY;
    });
    const avg = win.reduce((a, q) => a + q.value, 0) / win.length;
    return { ...p, avg: Math.round(avg * 10) / 10 };
  });
}

// Días desde el último registro de peso (null si nunca).
export function daysSinceWeight(entries, today) {
  const last = entries.filter((e) => e.weightKg > 0).map((e) => e.date).sort().at(-1);
  if (!last) return null;
  return Math.round((parseISODate(today) - parseISODate(last)) / DAY);
}
