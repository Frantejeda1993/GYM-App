// Lógica pura de sesiones (sin Firestore): plan de la semana, días perdidos,
// construcción de una sesión desde la plantilla y cambios a aplicar en la plantilla.
import { toISODate, weekDates, weekdayIndex, now, timestampToISODate } from './dates';
import { uid } from './text';

export const orderedSessions = (routine) =>
  [...(routine?.templateSessions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// Plan de la semana (modo por día): [{ date, templateSessionId | null }] × 7,
// aplicando la reorganización "solo esta semana" si existe.
export function weekPlan(routine, override, date = now()) {
  return weekDates(date).map((iso, wd) => {
    if (override?.assignments && iso in override.assignments) {
      return { date: iso, templateSessionId: override.assignments[iso] };
    }
    const s = (routine?.templateSessions || []).find((x) => x.weekday === wd);
    return { date: iso, templateSessionId: s?.id || null };
  });
}

// Sesión que toca hoy.
export function plannedSessionFor(routine, override, date = now()) {
  if (!routine) return null;
  if (routine.mode === 'weekly') {
    const p = weekPlan(routine, override, date).find((x) => x.date === toISODate(date));
    return routine.templateSessions.find((s) => s.id === p?.templateSessionId) || null;
  }
  const ordered = orderedSessions(routine);
  if (!ordered.length) return null;
  return ordered[(routine.nextSequenceIndex || 0) % ordered.length];
}

// Días de entreno anteriores a hoy (de esta semana) sin sesión registrada.
// Una sesión hecha otro día con la misma plantilla cuenta como hecha.
export function missedDays(routine, override, sessions, date = now()) {
  if (!routine || routine.mode !== 'weekly') return [];
  const today = toISODate(date);
  const since = timestampToISODate(routine.activatedAt) || timestampToISODate(routine.createdAt) || today;
  const plan = weekPlan(routine, override, date);
  const week = new Set(plan.map((p) => p.date));
  const pool = sessions.filter((s) => week.has(s.date) && s.routineId === routine.id);
  const used = new Set();
  const missed = [];
  for (const p of plan) {
    if (!p.templateSessionId || p.date >= today || p.date < since) continue;
    const match = pool.find((s) => !used.has(s.id) && s.templateSessionId === p.templateSessionId);
    if (match) used.add(match.id);
    else missed.push(p);
  }
  return missed;
}

function entryFromItem(item, exercise, extra = {}) {
  const plannedReps = item.reps ?? item.repMin;
  return {
    id: uid(),
    itemId: item.id,
    exerciseId: item.exerciseId,
    name: exercise?.name || '',
    loadType: exercise?.loadType || 'total',
    barKg: item.barKg || 0,
    // Se copian los músculos: si alguien edita el catálogo, el historial no cambia.
    primaryMuscles: exercise?.primaryMuscles || [],
    secondaryMuscles: exercise?.secondaryMuscles || [],
    repMin: item.repMin,
    repMax: item.repMax,
    restSec: item.restSec ?? 120,
    incrementKg: item.incrementKg,
    adhoc: false,
    sets: Array.from({ length: item.sets }, () => ({
      plannedKg: item.loadKg,
      plannedReps,
      kg: item.loadKg,
      reps: plannedReps,
      done: false,
    })),
    ...extra,
  };
}

function cardioFromItem(item, extra = {}) {
  const planned = { minutes: item.minutes ?? null, steps: item.steps ?? null, kcal: item.kcal ?? null };
  return { id: uid(), itemId: item.id, cardioType: item.cardioType, planned, ...planned, done: false, adhoc: false, ...extra };
}

// Documento de sesión nuevo a partir de una sesión de la plantilla.
export function buildSession(routine, templateSession, exerciseById, date = now()) {
  const entries = [];
  const cardio = [];
  templateSession.items.forEach((item, order) => {
    if (item.kind === 'cardio') cardio.push(cardioFromItem(item, { order }));
    else entries.push(entryFromItem(item, exerciseById(item.exerciseId), { order }));
  });
  return {
    date: toISODate(date),
    routineId: routine.id,
    templateSessionId: templateSession.id,
    sessionName: templateSession.name,
    status: 'in_progress',
    entries,
    cardio,
  };
}

// Ejercicio o cardio añadido durante la sesión.
export function adhocEntry(item, exercise, fixed, order) {
  return entryFromItem(item, exercise, { adhoc: true, fixed, order, itemId: item.id, newItem: fixed ? item : null });
}
export function adhocCardio(item, fixed, order) {
  return cardioFromItem(item, { adhoc: true, fixed, order, newItem: fixed ? item : null });
}

// Lista ordenada de entradas (fuerza y cardio mezclados como en la plantilla).
export const sessionItems = (session) =>
  [
    ...(session.entries || []).map((e) => ({ kind: 'strength', ...e })),
    ...(session.cardio || []).map((c) => ({ kind: 'cardio', ...c })),
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const countSets = (session) => {
  const all = (session.entries || []).flatMap((e) => e.sets);
  return { done: all.filter((s) => s.done).length, total: all.length };
};

export const anyMarked = (session) =>
  (session.entries || []).some((e) => e.sets.some((s) => s.done)) || (session.cardio || []).some((c) => c.done);

// Valor más repetido; en empate, el mayor.
function mode(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

// Cambios a aplicar en la plantilla al finalizar (siempre, a futuro).
// Devuelve { templateSessions, changes: [{ label, detail }] } o null si no hay cambios.
export function templateChanges(session, routine, describe) {
  const ts = routine?.templateSessions?.find((t) => t.id === session.templateSessionId);
  if (!ts) return null;
  const changes = [];
  const items = ts.items.map((item) => {
    if (item.kind === 'cardio') {
      const c = (session.cardio || []).find((x) => x.itemId === item.id && !x.adhoc);
      if (!c?.done) return item;
      const next = { ...item };
      ['minutes', 'steps', 'kcal'].forEach((k) => {
        if ((c[k] ?? null) !== (c.planned?.[k] ?? null)) next[k] = c[k] ?? null;
      });
      if (JSON.stringify(next) !== JSON.stringify(item)) changes.push({ label: `Cardio · ${item.cardioType}`, detail: 'objetivo actualizado' });
      return next;
    }
    const e = (session.entries || []).find((x) => x.itemId === item.id && !x.adhoc);
    if (!e) return item;
    const next = { ...item };
    const parts = [];
    if (e.sets.length !== item.sets) {
      next.sets = e.sets.length;
      parts.push(`${item.sets} → ${e.sets.length} series`);
    }
    const done = e.sets.filter((s) => s.done);
    if (done.length) {
      if (done.some((s) => s.kg !== s.plannedKg)) {
        const kg = mode(done.map((s) => s.kg));
        if (kg !== item.loadKg) {
          next.loadKg = kg;
          parts.push(`${describe(item.loadKg, e.loadType, e.barKg)} → ${describe(kg, e.loadType, e.barKg)}`);
        }
      }
      if (done.some((s) => s.reps !== s.plannedReps)) {
        const reps = mode(done.map((s) => s.reps));
        if (reps !== (item.reps ?? item.repMin)) {
          next.reps = reps;
          parts.push(`${item.reps ?? item.repMin} → ${reps} reps`);
        }
      }
    }
    if (parts.length) changes.push({ label: e.name, detail: parts.join(' · ') });
    return next;
  });
  // Añadidos como "fijo" durante la sesión
  (session.entries || []).filter((e) => e.adhoc && e.fixed && e.newItem).forEach((e) => {
    items.push({ ...e.newItem, sets: e.sets.length });
    changes.push({ label: e.name, detail: 'añadido a la rutina' });
  });
  (session.cardio || []).filter((c) => c.adhoc && c.fixed && c.newItem).forEach((c) => {
    items.push({ ...c.newItem, cardioType: c.cardioType, minutes: c.minutes ?? null, steps: c.steps ?? null, kcal: c.kcal ?? null });
    changes.push({ label: `Cardio · ${c.cardioType}`, detail: 'añadido a la rutina' });
  });
  if (!changes.length) return null;
  return {
    templateSessions: routine.templateSessions.map((t) => (t.id === ts.id ? { ...t, items } : t)),
    changes,
  };
}

// Siguiente índice de la secuencia tras finalizar una sesión.
export function nextSequenceIndex(routine, templateSessionId) {
  const ordered = orderedSessions(routine);
  const i = ordered.findIndex((s) => s.id === templateSessionId);
  if (i < 0) return routine.nextSequenceIndex || 0;
  return (i + 1) % ordered.length;
}

// Propuesta inicial para reorganizar la semana: las sesiones pendientes (perdidas
// primero) se colocan en orden en los días de entreno que quedan, hoy incluido.
export function proposeReorganization(routine, override, missed, date = now()) {
  const today = toISODate(date);
  const plan = weekPlan(routine, override, date);
  const remaining = plan.filter((p) => p.date >= today);
  const queue = [...missed.map((m) => m.templateSessionId), ...remaining.filter((p) => p.templateSessionId).map((p) => p.templateSessionId)];
  const slots = remaining.filter((p) => p.templateSessionId || p.date === today).map((p) => p.date);
  const assignments = Object.fromEntries(remaining.map((p) => [p.date, null]));
  slots.forEach((d, i) => {
    assignments[d] = queue[i] ?? null;
  });
  return { remaining: remaining.map((p) => p.date), assignments, pool: queue };
}

export { weekdayIndex };
