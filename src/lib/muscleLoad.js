// Series semanales por músculo: principal = 1 serie, secundario = 0,5.
import { weekPlan } from './sessions';
import { weekDates } from './dates';
import { SMALL_MUSCLES } from './muscles';

function addSets(acc, primary = [], secondary = [], sets) {
  primary.forEach((m) => { acc[m] = (acc[m] || 0) + sets; });
  secondary.forEach((m) => { acc[m] = (acc[m] || 0) + sets * 0.5; });
}

// Lo planificado para la semana de `date`. En modo secuencial se cuenta un ciclo completo.
export function plannedSets(routine, override, date, exerciseById) {
  const acc = {};
  if (!routine) return acc;
  let sessions;
  if (routine.mode === 'weekly') {
    sessions = weekPlan(routine, override, date)
      .filter((p) => p.templateSessionId)
      .map((p) => routine.templateSessions.find((s) => s.id === p.templateSessionId))
      .filter(Boolean);
  } else {
    sessions = routine.templateSessions || [];
  }
  sessions.forEach((s) =>
    s.items.forEach((it) => {
      if (it.kind !== 'strength') return;
      const ex = exerciseById(it.exerciseId);
      if (ex) addSets(acc, ex.primaryMuscles, ex.secondaryMuscles, Number(it.sets) || 0);
    }),
  );
  return acc;
}

// Lo realizado: series marcadas en sesiones finalizadas de esa semana.
// Usa los músculos copiados en la sesión (el historial no cambia si se edita el catálogo).
export function doneSetsByMuscle(sessions, date) {
  const week = new Set(weekDates(date));
  const acc = {};
  sessions
    .filter((s) => s.status === 'done' && week.has(s.date))
    .forEach((s) =>
      (s.entries || []).forEach((e) => {
        const n = e.sets.filter((x) => x.done).length;
        if (n) addSets(acc, e.primaryMuscles, e.secondaryMuscles, n);
      }),
    );
  return acc;
}

// Niveles 0–4. Grupos pequeños con umbrales reducidos.
const NORMAL = [1, 5, 10, 21]; // 1–4 · 5–9 · 10–20 · >20
const SMALL = [1, 3, 6, 11]; // 1–2 · 3–5 · 6–10 · >10
export function level(sets, muscle) {
  const t = SMALL_MUSCLES.has(muscle) ? SMALL : NORMAL;
  let l = 0;
  t.forEach((min, i) => { if (sets >= min) l = i + 1; });
  return l;
}

// Regiones del dibujo → músculos del catálogo (la región toma el valor del más trabajado).
export const REGION_MUSCLES = {
  chest: ['chest'],
  abs: ['abdominals'],
  obliques: ['abdominals'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearm: ['forearms'],
  deltoids: ['shoulders'],
  trapezius: ['traps'],
  'upper-back': ['lats', 'middle back'],
  'lower-back': ['lower back'],
  gluteal: ['glutes', 'abductors'],
  hamstring: ['hamstrings'],
  quadriceps: ['quadriceps'],
  calves: ['calves'],
  adductors: ['adductors'],
  neck: ['neck'],
};

export function regionLevel(slug, values) {
  const muscles = REGION_MUSCLES[slug];
  if (!muscles) return null;
  return Math.max(...muscles.map((m) => level(values[m] || 0, m)));
}
