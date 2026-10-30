// Lógica pura de sesiones (sin Firestore): plan de la semana, días perdidos,
// construcción de una sesión desde la plantilla y cambios a aplicar en la plantilla.
import { toISODate, weekDates, weekdayIndex, now, timestampToISODate } from './dates';
import { uid } from './text';
import { storedToInput } from './load';
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
    split: !!item.splitSides && canSplit(exercise?.loadType),
    adhoc: false,
    sets: Array.from({ length: item.sets }, (_, i) => {
      const kg = item.loadMode === 'progressive' ? item.setLoads?.[i] ?? item.setLoads?.at(-1) ?? item.loadKg : item.loadKg;
      const set = { plannedKg: kg, plannedReps, kg, reps: plannedReps, done: false, feel: null };
      if (!item.splitSides || !canSplit(exercise?.loadType)) return set;
      // Peso por mano guardado en la rutina (solo peso fijo); si no, mitades iguales.
      const sides = item.loadMode !== 'progressive' && item.sideLoads?.length === 2
        ? { kgL: item.sideLoads[0], kgR: item.sideLoads[1] }
        : splitOf(kg, exercise?.loadType);
      return { ...set, ...sides };
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

// ---------- Peso distinto por mano (mancuernas y máquinas con brazos independientes) ----------

// Solo mancuernas (kg por mano) y máquinas/poleas (kg total).
export const canSplit = (loadType) => loadType === 'dumbbell' || loadType === 'total';

// Reparte un peso guardado en izquierda/derecha iguales.
export function splitOf(kg, loadType) {
  const half = loadType === 'total' ? Math.round((kg / 2) * 100) / 100 : kg;
  return { kgL: half, kgR: half };
}

// Peso guardado a partir de cada lado: mancuerna = media por mano; máquina = suma.
export function kgFromSides(kgL, kgR, loadType) {
  const l = Number(kgL) || 0;
  const r = Number(kgR) || 0;
  return Math.round((loadType === 'total' ? l + r : (l + r) / 2) * 100) / 100;
}

// ---------- Última vez ----------

// Entrada más reciente del mismo ejercicio en una sesión finalizada anterior (cualquier rutina).
export function lastTimeFor(sessions, exerciseId, current) {
  const prev = sessions
    .filter((s) => s.status === 'done' && s.id !== current?.id && (!current || s.date <= current.date))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const s of prev) {
    const e = (s.entries || []).find((x) => x.exerciseId === exerciseId && x.sets.some((set) => set.done));
    if (e) return { date: s.date, entry: e };
  }
  return null;
}

// Valor más repetido; en empate, el mayor.
function mode(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

const round2 = (n) => Math.round(n * 100) / 100;

const plannedLoadAt = (item, i) =>
  item.loadMode === 'progressive' ? item.setLoads?.[i] ?? item.setLoads?.at(-1) ?? item.loadKg : item.loadKg;

// Dónde está una sesión de la plantilla, para mostrarlo ("Jueves · Torso B").
const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const placeOf = (routine, ts) => (routine.mode === 'weekly' && ts.weekday != null ? `${WEEKDAY_NAMES[ts.weekday]} · ${ts.name}` : ts.name);

// Otros ítems de la rutina con el mismo ejercicio (en otras sesiones o en la misma).
export function linkedItems(routine, itemId, exerciseId) {
  const out = [];
  (routine?.templateSessions || []).forEach((ts) =>
    (ts.items || []).forEach((it) => {
      if (it.kind === 'strength' && it.exerciseId === exerciseId && it.id !== itemId) out.push({ ts, item: it, place: placeOf(routine, ts) });
    }),
  );
  return out;
}

// Cambios propuestos para la plantilla al finalizar. Cada cambio:
// { id, itemId, label, detail, down, kind, patch, alsoIn? }
//   kind 'update'      → se aplica si sube; si baja, se pregunta
//   kind 'progression' → propuesta de subir/bajar el incremento (se pregunta)
//   kind 'mixed'       → peso fijo hecho con pesos distintos: elegir opción (choices)
//   kind 'add'         → ejercicio/cardio añadido como fijo
// alsoIn: otros días de la rutina con el mismo ejercicio, que reciben la misma subida/bajada de peso.
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
    const unitWord = e.loadType === 'barbell' ? 'kg por lado' : e.loadType === 'dumbbell' ? 'kg por mano' : e.loadType === 'bodyweight' ? 'kg de lastre' : 'kg';
    const fmtList = (list) => `${list.map((kg) => fmtShort(storedToInput(kg, e.loadType, e.barKg))).join(' / ')} ${unitWord}`;
    const alsoIn = linkedItems(routine, item.id, item.exerciseId).map((l) => l.place);
    const weight = (c) => push({ ...c, alsoIn });

    if (e.sets.length !== item.sets) {
      push({
        id: `${item.id}:sets`, itemId: item.id, label: e.name, detail: `${item.sets} → ${e.sets.length} series`,
        down: e.sets.length < item.sets, patch: { field: 'sets', value: e.sets.length, loads: e.sets.map((x) => x.kg) },
      });
    }
    if (!!e.split !== !!item.splitSides) {
      push({ id: `${item.id}:split`, itemId: item.id, label: e.name, detail: e.split ? 'peso distinto por mano' : 'mismo peso en ambas manos', down: false, patch: { field: 'splitSides', value: !!e.split } });
    }
    const done = e.sets.map((x, i) => ({ ...x, i })).filter((x) => x.done);
    if (!done.length) return;

    // Peso por mano (peso fijo): se guarda el reparto izquierda/derecha más repetido.
    if (e.split && item.loadMode !== 'progressive') {
      const pairs = done.filter((x) => x.kgL != null).map((x) => `${x.kgL}|${x.kgR}`);
      if (pairs.length) {
        const counts = new Map();
        pairs.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split('|').map(Number);
        const old = item.sideLoads?.join('|');
        if (old !== top.join('|')) {
          push({ id: `${item.id}:sides`, itemId: item.id, label: e.name, detail: `por mano ${fmtShort(top[0])} / ${fmtShort(top[1])} kg (izq. / der.)`, down: false, patch: { field: 'sideLoads', value: top } });
        }
      }
    }

    if (item.loadMode === 'progressive') {
      // Progresivo: se actualiza el peso de cada serie hecha.
      done.forEach((x) => {
        const old = plannedLoadAt(item, x.i);
        if (x.i < item.sets && x.kg !== old) {
          weight({ id: `${item.id}:set${x.i}`, itemId: item.id, label: `${e.name} · serie ${x.i + 1}`, detail: `${fmt(old)} → ${fmt(x.kg)}`, down: x.kg < old, patch: { field: 'setLoad', index: x.i, value: x.kg } });
        }
      });
    } else {
      const kgs = done.map((x) => x.kg);
      const max = Math.max(...kgs);
      if (new Set(kgs).size > 1) {
        // Fijo pero con pesos distintos: el usuario elige.
        const loads = e.sets.map((x) => (x.done ? x.kg : x.plannedKg));
        changes.push({
          kind: 'mixed', id: `${item.id}:mixed`, itemId: item.id, label: e.name, alsoIn,
          detail: `Hiciste ${fmtList(kgs)} con peso fijo.`,
          options: [
            { key: 'progressive', label: `Pasar a peso progresivo: ${fmtList(loads)}`, patch: { field: 'toProgressive', loads } },
            { key: 'fixed', label: `Seguir fijo con ${fmt(max)}`, patch: { field: 'loadKg', value: max } },
            { key: 'keep', label: `No cambiar (${fmt(item.loadKg)})`, patch: null },
          ],
        });
      } else if (max !== item.loadKg) {
        weight({ id: `${item.id}:load`, itemId: item.id, label: e.name, detail: `${fmt(item.loadKg)} → ${fmt(max)}`, down: max < item.loadKg, patch: { field: 'loadKg', value: max } });
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
      const inc = String(Math.abs(prog.delta)).replace('.', ',');
      changes.push({
        kind: 'progression', id: `${item.id}:prog`, itemId: item.id, label: e.name, down: !up, alsoIn, patch: { field: 'progress', delta: prog.delta },
        detail: up
          ? `${prog.reason === 'easy' ? 'Todas las series te salieron sobradas' : `Completaste ${item.repMax} reps en todas las series`}: subir ${inc} kg${item.loadMode === 'progressive' ? ' en cada serie' : ''} y volver a ${item.repMin} reps`
          : `Dos sesiones por debajo de ${item.repMin} reps: bajar ${inc} kg`,
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

const fmtShort = (v) => String(round2(v)).replace('.', ',');

// Decisiones por defecto: subidas y progresiones hacia arriba aceptadas; bajadas no.
// En pesos mixtos, la opción por defecto es pasar a progresivo.
export const defaultAccepted = (changes) => new Set(changes.filter((c) => c.kind !== 'mixed' && !c.down).map((c) => c.id));
export const defaultChoices = (changes) => Object.fromEntries(changes.filter((c) => c.kind === 'mixed').map((c) => [c.id, 'progressive']));

// Suma `delta` kg al peso de un ítem (fijo o progresivo), sin bajar de la barra vacía ni de 0.
function shiftLoad(item, delta, loadType) {
  const floor = loadType === 'barbell' ? item.barKg || 0 : 0;
  const clamp = (v) => Math.max(floor, round2(v + delta));
  const next = { ...item, loadKg: clamp(item.loadKg) };
  if (item.sideLoads?.length === 2) {
    // Máquina (total): la subida se reparte entre los dos lados; mancuerna: se suma a cada mano.
    const d = loadType === 'total' ? delta / 2 : delta;
    next.sideLoads = item.sideLoads.map((v) => Math.max(0, round2(v + d)));
  }
  if (item.loadMode === 'progressive' && item.setLoads?.length) {
    next.setLoads = item.setLoads.map(clamp);
    next.loadKg = Math.max(...next.setLoads);
  }
  return next;
}

// Nueva lista de sesiones de la plantilla con los cambios aceptados, o null si no cambia nada.
// - accepted: Set de ids aceptados (las subidas se aplican siempre).
// - choices: { idCambioMixto: 'progressive' | 'fixed' | 'keep' }.
// - loadTypeOf(exerciseId): tipo de carga, para no bajar de la barra vacía al propagar.
// La variación del peso de un ejercicio se propaga como misma subida/bajada a los demás
// ítems de la rutina con ese ejercicio (punto de partida de cada uno respetado).
export function applyChanges(routine, templateSessionId, changes, accepted, choices = {}, loadTypeOf = () => null) {
  const chosen = [];
  changes.forEach((c) => {
    if (c.kind === 'mixed') {
      const opt = c.options.find((o) => o.key === (choices[c.id] || 'progressive'));
      if (opt?.patch) chosen.push({ ...c, patch: opt.patch });
    } else if (c.down || c.kind === 'progression' ? accepted.has(c.id) : true) {
      chosen.push(c);
    }
  });
  if (!chosen.length) return null;
  const ts = routine.templateSessions.find((t) => t.id === templateSessionId);
  if (!ts) return null;
  const order = { sets: 0, toProgressive: 1, loadKg: 1, setLoad: 1, reps: 2, splitSides: 2, sideLoads: 2, progress: 3 };
  const deltas = new Map(); // exerciseId → variación de peso a propagar
  let items = ts.items.map((item) => {
    const mine = chosen.filter((c) => c.itemId === item.id).sort((a, b) => (order[a.patch.field] ?? 1) - (order[b.patch.field] ?? 1));
    if (!mine.length) return item;
    let next = { ...item, setLoads: item.setLoads ? [...item.setLoads] : item.setLoads };
    mine.forEach(({ patch }) => {
      switch (patch.field) {
        case 'sets':
          if (next.loadMode === 'progressive') {
            next.setLoads = Array.from({ length: patch.value }, (_, i) => next.setLoads?.[i] ?? patch.loads[i] ?? next.setLoads?.at(-1) ?? next.loadKg);
          }
          next.sets = patch.value;
          break;
        case 'toProgressive':
          next.loadMode = 'progressive';
          next.setLoads = Array.from({ length: next.sets }, (_, i) => patch.loads[i] ?? patch.loads.at(-1));
          break;
        case 'setLoad':
          if (next.setLoads && patch.index < next.setLoads.length) next.setLoads[patch.index] = patch.value;
          break;
        case 'progress':
          next = shiftLoad(next, patch.delta, loadTypeOf(item.exerciseId));
          if (patch.delta > 0) next.reps = next.repMin; // doble progresión: tras subir peso, vuelta al mínimo
          break;
        default:
          next[patch.field] = patch.value;
      }
    });
    if (next.loadMode === 'progressive' && next.setLoads?.length) next.loadKg = Math.max(...next.setLoads);
    const delta = round2((next.loadKg || 0) - (item.loadKg || 0));
    if (delta !== 0) deltas.set(item.exerciseId, { delta, from: item.id });
    return next;
  });
  chosen.filter((c) => c.kind === 'add').forEach((c) => items.push(c.patch.item));

  let templateSessions = routine.templateSessions.map((t) => (t.id === ts.id ? { ...t, items } : t));
  // Misma subida/bajada en el resto de la rutina para el mismo ejercicio.
  if (deltas.size) {
    templateSessions = templateSessions.map((t) => ({
      ...t,
      items: t.items.map((it) => {
        const d = it.kind === 'strength' && deltas.get(it.exerciseId);
        if (!d || it.id === d.from) return it;
        return shiftLoad(it, d.delta, loadTypeOf(it.exerciseId));
      }),
    }));
  }
  return templateSessions;
}

// Huella estable de la plantilla (claves ordenadas) para saber si cambió desde que se finalizó.
export function templateKey(templateSessions) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, norm(v[k])]));
    }
    return v;
  };
  return JSON.stringify(norm(templateSessions || []));
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
