import { uid } from './text';
import { LOAD_TYPES } from './load';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const CARDIO_TYPES = ['Cinta', 'Bicicleta', 'Elíptica', 'Remo', 'Caminar', 'Correr', 'Escaleras', 'Otro'];

export { weekdayIndex } from './dates';

export const sequenceLetter = (i) => String.fromCharCode(65 + (i % 26));

export function newStrengthItem(exercise, profile) {
  const lt = exercise.loadType || 'total';
  return {
    id: uid(),
    kind: 'strength',
    exerciseId: exercise.id,
    sets: 3,
    repMin: 5,
    repMax: 8,
    loadKg: lt === 'barbell' ? Number(exercise.defaultBarKg ?? profile?.defaultBarKg ?? 20) : 0,
    barKg: lt === 'barbell' ? Number(exercise.defaultBarKg ?? profile?.defaultBarKg ?? 20) : 0,
    restSec: 120,
    loadMode: 'fixed', // 'fixed' | 'progressive' (un peso por serie en setLoads)
    setLoads: null,
    incrementKg: LOAD_TYPES[lt]?.increment ?? 2.5,
  };
}

export function newCardioItem() {
  return { id: uid(), kind: 'cardio', cardioType: 'Cinta', minutes: 20, steps: '', kcal: '' };
}

export function newSession(name, extra = {}) {
  return { id: uid(), name, items: [], ...extra };
}

export function cardioSummary(c) {
  const parts = [];
  if (c.minutes) parts.push(`${c.minutes} min`);
  if (c.steps) parts.push(`${Number(c.steps).toLocaleString('es-ES')} pasos`);
  if (c.kcal) parts.push(`${c.kcal} kcal`);
  return parts.join(' · ') || 'Sin objetivo';
}

// "3 × 6 (5–8)" si hay repeticiones actuales; "3 × 5–8" si solo hay rango.
export function setsLabel(it) {
  const range = `${it.repMin}–${it.repMax}`;
  return it.reps ? `${it.sets} × ${it.reps} (${range})` : `${it.sets} × ${range}`;
}
