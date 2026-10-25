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

// ---------- Análisis de composición ----------

// Por debajo de este cambio (kg) la bioimpedancia no distingue variación real de ruido.
const NOISE_KG = 0.3;

// Rangos orientativos de % de grasa (ACE) y % de agua por sexo.
const FAT_RANGES = {
  male: [[6, 'Esencial'], [14, 'Atlético'], [18, 'En forma'], [25, 'Promedio'], [Infinity, 'Elevado']],
  female: [[14, 'Esencial'], [21, 'Atlético'], [25, 'En forma'], [32, 'Promedio'], [Infinity, 'Elevado']],
};
const WATER_RANGES = { male: [50, 65], female: [45, 60] };

// Rangos de referencia [hasta, etiqueta]. IMC según la OMS; FFMI según estudios con personas que entrenan.
export const BMI_RANGES = [[18.5, 'Bajo peso'], [25, 'Normal'], [30, 'Sobrepeso'], [Infinity, 'Obesidad']];
export const FFMI_RANGES = {
  male: [[18, 'Bajo'], [20, 'Promedio'], [22, 'Bueno'], [23, 'Muy bueno'], [25, 'Excelente'], [Infinity, 'Élite']],
  female: [[14, 'Bajo'], [16, 'Promedio'], [18, 'Bueno'], [19, 'Muy bueno'], [21, 'Excelente'], [Infinity, 'Élite']],
};
export const rangeLabel = (ranges, v) => (v == null || !ranges ? null : ranges.find(([max]) => v < max)[1]);

// Altura en cm; acepta también metros (1,75 → 175) por si se escribe así.
export function heightToCm(v) {
  const n = Number(v);
  if (!(n > 0)) return null;
  return n < 3 ? Math.round(n * 100) : n;
}

// Pasa una medición a kg y % (convierte con el peso del mismo registro).
export function compOf(e) {
  const w = e.weightKg > 0 ? e.weightKg : null;
  const part = (m) => {
    if (!(m?.value > 0)) return null;
    if (m.unit === 'kg') return { kg: m.value, pct: w ? (m.value / w) * 100 : null };
    return { pct: m.value, kg: w ? (m.value * w) / 100 : null };
  };
  const fat = part(e.fat);
  return {
    id: e.id,
    date: e.date,
    method: e.method,
    weight: w,
    fat,
    muscle: part(e.muscle),
    water: part(e.water),
    lean: w && fat?.kg != null ? w - fat.kg : null,
  };
}

export function fatCategory(pct, sex) {
  if (pct == null || !FAT_RANGES[sex]) return null;
  return FAT_RANGES[sex].find(([max]) => pct < max)[1];
}

// Lectura del cambio de grasa y músculo (kg) entre dos mediciones.
export function verdict(dFat, dMuscle) {
  if (dFat == null || dMuscle == null) return null;
  const f = Math.abs(dFat) < NOISE_KG ? 0 : Math.sign(dFat);
  const m = Math.abs(dMuscle) < NOISE_KG ? 0 : Math.sign(dMuscle);
  if (f < 0 && m > 0) return { tone: 'good', title: 'Recomposición', text: 'Pierdes grasa y ganas músculo a la vez: el mejor escenario.' };
  if (f < 0 && m === 0) return { tone: 'good', title: 'Definición limpia', text: 'Bajas grasa manteniendo el músculo.' };
  if (f < 0 && m < 0) {
    return -dMuscle > -dFat * 0.5
      ? { tone: 'bad', title: 'Pierdes músculo', text: 'Bajas grasa pero también bastante músculo: revisa la proteína (≈1,6–2,2 g/kg) y que el déficit no sea excesivo.' }
      : { tone: 'neutral', title: 'Definición', text: 'Bajas sobre todo grasa, con algo de músculo: normal en déficit.' };
  }
  if (f === 0 && m > 0) return { tone: 'good', title: 'Ganancia muscular', text: 'Ganas músculo sin sumar grasa.' };
  if (f === 0 && m === 0) return { tone: 'neutral', title: 'Estable', text: 'Sin cambios relevantes (dentro del margen de error de la báscula).' };
  if (f === 0 && m < 0) return { tone: 'bad', title: 'Pérdida de músculo', text: 'Baja el músculo sin cambiar la grasa: revisa volumen de entrenamiento, proteína y descanso.' };
  if (f > 0 && m > 0) {
    return dMuscle >= dFat
      ? { tone: 'good', title: 'Volumen limpio', text: 'Ganas más músculo que grasa.' }
      : { tone: 'neutral', title: 'Volumen', text: 'Ganas músculo, pero más grasa que músculo: si buscas un volumen limpio, reduce un poco el superávit.' };
  }
  if (f > 0 && m === 0) return { tone: 'bad', title: 'Ganancia de grasa', text: 'Sube la grasa sin ganar músculo.' };
  return { tone: 'bad', title: 'A revisar', text: 'Sube la grasa y baja el músculo.' };
}

function diff(a, b) {
  const d = (x, y) => (x != null && y != null ? y - x : null);
  const days = Math.round((parseISODate(b.date) - parseISODate(a.date)) / DAY);
  const r = {
    from: a.date,
    days,
    weight: d(a.weight, b.weight),
    fatKg: d(a.fat?.kg, b.fat?.kg),
    fatPct: d(a.fat?.pct, b.fat?.pct),
    muscleKg: d(a.muscle?.kg, b.muscle?.kg),
    musclePct: d(a.muscle?.pct, b.muscle?.pct),
    waterPct: d(a.water?.pct, b.water?.pct),
    leanKg: d(a.lean, b.lean),
  };
  r.verdict = verdict(r.fatKg, r.muscleKg);
  // Ritmo mensual, solo con suficiente distancia entre mediciones
  r.perMonth = days >= 21 ? (v) => (v == null ? null : (v * 30) / days) : null;
  return r;
}

// Análisis de la última medición de composición frente a la anterior y la primera del mismo método.
export function analyze(entries, { sex, heightCm } = {}) {
  const comps = entries
    .filter((e) => e.fat?.value > 0 || e.muscle?.value > 0 || e.water?.value > 0)
    .map(compOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!comps.length) return null;
  const last = comps.at(-1);
  const same = comps.filter((c) => c.method === last.method);
  const prev = same.length > 1 ? same.at(-2) : null;
  const first = same.length > 2 ? same[0] : null;
  const cm = heightToCm(heightCm);
  const h = cm ? cm / 100 : null;
  const sincePrev = prev && diff(prev, last);
  const sinceFirst = first && diff(first, last);

  const notes = [];
  const water = WATER_RANGES[sex];
  if (water && last.water?.pct != null && last.water.pct < water[0]) {
    notes.push('El agua está por debajo de lo habitual: la báscula puede sobrestimar la grasa. Bebe con normalidad el día anterior a medirte.');
  }
  if (sincePrev?.waterPct != null && Math.abs(sincePrev.waterPct) >= 2) {
    notes.push(`El agua varió ${Math.abs(sincePrev.waterPct).toFixed(1).replace('.', ',')} puntos desde la medición anterior: parte del cambio de grasa/músculo puede ser hidratación.`);
  }
  if (same.length < comps.length) notes.push('Solo se compara con mediciones del mismo método.');
  notes.push('Para comparar bien, mídete siempre en las mismas condiciones: en ayunas, tras ir al baño y sin haber entrenado.');

  return {
    last,
    count: same.length,
    fatCat: fatCategory(last.fat?.pct, sex),
    waterRange: water || null,
    bmi: h && last.weight ? last.weight / (h * h) : null,
    ffmi: h && last.lean ? last.lean / (h * h) : null,
    heightCm: cm,
    sincePrev,
    sinceFirst,
    notes,
  };
}
