// Lógica pura de sesiones (sin Firestore): plan de la semana, días perdidos,
// construcción de una sesión desde la plantilla y cambios a aplicar en la plantilla.
import { toISODate, weekDates, weekdayIndex, now, timestampToISODate } from './dates';
import { uid } from './text';
import { progressionFor, previousEntry } from './progression';

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
    loadMode: item.loadMode || 'fixed',
    adhoc: false,
    sets: Array.from({ length: item.sets }, (_, i) => {
      const kg = item.loadMode === 'progressive' ? item.setLoads?.[i] ?? item.setLoads?.at(-1) ?? item.loadKg : item.loadKg;
      return { plannedKg: kg, plannedReps, kg, reps: plannedReps, done: false };
    }),
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

const plannedLoadAt = (item, i) =>
  item.loadMode === 'progressive' ? item.setLoads?.[i] ?? item.setLoads?.at(-1) ?? item.loadKg : item.loadKg;

// Cambios propuestos para la plantilla al finalizar. Cada cambio:
// { id, itemId, label, detail, down, kind: 'update' | 'progression' | 'add', patch }
// Regla: lo que sube se aplica siempre; lo que baja y las progresiones se preguntan.
export function computeChanges(session, routine, describe, sessions = []) {
  const ts = routine?.templateSessions?.find((t) => t.id === session.templateSessionId);
  if (!ts) return [];
  const changes = [];
  const push = (c) => changes.push({ kind: 'update', ...c });

  ts.items.forEach((item) => {
    if (item.kind === 'cardio') {
      const c = (session.cardio || []).find((x) => x.itemId === item.id && !x.adhoc);
      if (!c?.done) return;
      [['minutes', 'min'], ['steps', 'pasos'], ['kcal', 'kcal']].forEach(([k, unit]) => {
        const v = c[k] ?? null;
        const old = item[k] ?? null;
        if (v != null && v !== old) {
          push({ id: `${item.id}:${k}`, itemId: item.id, label: `Cardio · ${c.cardioType}`, detail: `${old ?? 0} → ${v} ${unit}`, down: v < (old ?? 0), patch: { field: k, value: v } });
        }
      });
      return;
    }
    const e = (session.entries || []).find((x) => x.itemId === item.id && !x.adhoc);
    if (!e) return;
    const fmt = (kg) => describe(kg, e.loadType, e.barKg);
    if (e.sets.length !== item.sets) {
      push({
        id: `${item.id}:sets`, itemId: item.id, label: e.name, detail: `${item.sets} → ${e.sets.length} series`,
        down: e.sets.length < item.sets, patch: { field: 'sets', value: e.sets.length, loads: e.sets.map((x) => x.kg) },
      });
    }
    const done = e.sets.map((x, i) => ({ ...x, i })).filter((x) => x.done);
    if (!done.length) return;
    if (item.loadMode === 'progressive') {
      // Progresivo: se actualiza el peso de cada serie hecha.
      done.forEach((x) => {
        const old = plannedLoadAt(item, x.i);
        if (x.i < item.sets && x.kg !== old) {
          push({ id: `${item.id}:set${x.i}`, itemId: item.id, label: `${e.name} · serie ${x.i + 1}`, detail: `${fmt(old)} → ${fmt(x.kg)}`, down: x.kg < old, patch: { field: 'setLoad', index: x.i, value: x.kg } });
        }
      });
    } else {
      // Fijo: se usa el mayor peso alcanzado.
      const max = Math.max(...done.map((x) => x.kg));
      if (max !== item.loadKg) {
        push({ id: `${item.id}:load`, itemId: item.id, label: e.name, detail: `${fmt(item.loadKg)} → ${fmt(max)}`, down: max < item.loadKg, patch: { field: 'loadKg', value: max } });
      }
    }
    const reps = mode(done.map((x) => x.reps));
    const oldReps = item.reps ?? item.repMin;
    if (reps !== oldReps) {
      push({ id: `${item.id}:reps`, itemId: item.id, label: e.name, detail: `${oldReps} → ${reps} reps`, down: reps < oldReps, patch: { field: 'reps', value: reps } });
    }
    const prog = progressionFor({ ...item, loadType: e.loadType }, e, previousEntry(sessions, session, e));
    if (prog) {
      const up = prog.dir === 'up';
      changes.push({
        kind: 'progression', id: `${item.id}:prog`, itemId: item.id, label: e.name, down: !up, patch: { field: 'progress', delta: prog.delta },
        detail: up
          ? `Completaste ${item.repMax} reps en todas las series: subir ${String(prog.delta).replace('.', ',')} kg${item.loadMode === 'progressive' ? ' en cada serie' : ''} y volver a ${item.repMin} reps`
          : `Dos sesiones por debajo de ${item.repMin} reps: bajar ${String(-prog.delta).replace('.', ',')} kg`,
      });
    }
  });

  (session.entries || []).filter((e) => e.adhoc && e.fixed && e.newItem).forEach((e) => {
    changes.push({ kind: 'add', id: `add:${e.id}`, label: e.name, detail: 'añadido a la rutina', down: false, patch: { item: { ...e.newItem, sets: e.sets.length } } });
  });
  (session.cardio || []).filter((c) => c.adhoc && c.fixed && c.newItem).forEach((c) => {
    changes.push({
      kind: 'add', id: `add:${c.id}`, label: `Cardio · ${c.cardioType}`, detail: 'añadido a la rutina', down: false,
      patch: { item: { ...c.newItem, cardioType: c.cardioType, minutes: c.minutes ?? null, steps: c.steps ?? null, kcal: c.kcal ?? null } },
    });
  });
  return changes;
}

// Cambios que se aplican por defecto: los que suben y las progresiones hacia arriba.
export const defaultAccepted = (changes) => new Set(changes.filter((c) => !c.down).map((c) => c.id));

// Nueva lista de sesiones de la plantilla con los cambios aceptados, o null si no cambia nada.
export function applyChanges(routine, templateSessionId, changes, accepted) {
  const chosen = changes.filter((c) => (c.down || c.kind === 'progression' ? accepted.has(c.id) : true));
  if (!chosen.length) return null;
  const ts = routine.templateSessions.find((t) => t.id === templateSessionId);
  if (!ts) return null;
  const order = { sets: 0, loadKg: 1, setLoad: 1, reps: 2, progress: 3 };
  let items = ts.items.map((item) => {
    const mine = chosen.filter((c) => c.itemId === item.id).sort((a, b) => (order[a.patch.field] ?? 1) - (order[b.patch.field] ?? 1));
    if (!mine.length) return item;
    const next = { ...item, setLoads: item.setLoads ? [...item.setLoads] : item.setLoads };
    mine.forEach(({ patch }) => {
      switch (patch.field) {
        case 'sets':
          if (next.loadMode === 'progressive') {
            next.setLoads = Array.from({ length: patch.value }, (_, i) => next.setLoads?.[i] ?? patch.loads[i] ?? next.setLoads?.at(-1) ?? next.loadKg);
          }
          next.sets = patch.value;
          break;
        case 'setLoad':
          if (next.setLoads && patch.index < next.setLoads.length) next.setLoads[patch.index] = patch.value;
          break;
        case 'progress':
          if (next.loadMode === 'progressive' && next.setLoads) next.setLoads = next.setLoads.map((v) => Math.round((v + patch.delta) * 100) / 100);
          next.loadKg = Math.round((next.loadKg + patch.delta) * 100) / 100;
          if (patch.delta > 0) next.reps = next.repMin; // doble progresión: tras subir peso, vuelta al mínimo
          break;
        default:
          next[patch.field] = patch.value;
      }
    });
    if (next.loadMode === 'progressive' && next.setLoads?.length) next.loadKg = Math.max(...next.setLoads);
    return next;
  });
  chosen.filter((c) => c.kind === 'add').forEach((c) => items.push(c.patch.item));
  return routine.templateSessions.map((t) => (t.id === ts.id ? { ...t, items } : t));
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
