// "Proponer mejoras": revisión de TODA la rutina agrupada en pasos. Cada paso explica el problema,
// dónde aparece y, si se puede, ofrece aplicarlo automáticamente. Los pasos ignorados se guardan en
// la rutina (`ignoredTips`) y no se vuelven a proponer.
import { GROUPS, contribution, isCompound, isIsolation, sessionMinutes } from './routineReview';
import { WEEKDAYS, newStrengthItem } from './routine';

// Ejercicio del catálogo base que se añade al aplicar una mejora de volumen.
export const SUGGESTED = {
  chest: 'Barbell_Bench_Press_-_Medium_Grip',
  back: 'Wide-Grip_Lat_Pulldown',
  shoulders: 'Side_Lateral_Raise',
  quads: 'Leg_Press',
  hamstrings: 'Romanian_Deadlift',
  glutes: 'Barbell_Hip_Thrust',
  biceps: 'Dumbbell_Bicep_Curl',
  triceps: 'Triceps_Pushdown',
  calves: 'Standing_Calf_Raises',
  abs: 'Cable_Crunch',
};
const ROW = 'Seated_Cable_Rows';

const r1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const clone = (x) => JSON.parse(JSON.stringify(x));
const placeOf = (r, s) => (r.mode === 'weekly' ? `${WEEKDAYS[s.weekday]} · ${s.name}` : s.name);
const orderedSessions = (r) => [...(r.templateSessions || [])].sort((a, b) => (r.mode === 'weekly' ? a.weekday - b.weekday : a.order - b.order));

// Recorre los ítems de fuerza con su ejercicio y permite sustituirlos (fn devuelve el ítem nuevo).
function mapStrength(r, fn, exerciseById) {
  const next = clone(r);
  next.templateSessions = next.templateSessions.map((s) => ({
    ...s,
    items: s.items.map((it) => (it.kind === 'strength' ? fn(it, exerciseById(it.exerciseId), s) : it)),
  }));
  return next;
}

function trimSets(it, n) {
  const sets = Math.max(1, n);
  return { ...it, sets, setLoads: it.setLoads ? it.setLoads.slice(0, sets) : it.setLoads, loadKg: it.setLoads ? Math.max(...it.setLoads.slice(0, sets)) : it.loadKg };
}
function addSet(it) {
  return { ...it, sets: it.sets + 1, setLoads: it.setLoads ? [...it.setLoads, it.setLoads.at(-1)] : it.setLoads };
}

// Volumen de un grupo: directo (principal) por sesión.
function groupStats(r, exerciseById) {
  const volume = {};
  const direct = {};
  const perSession = {};
  Object.keys(GROUPS).forEach((g) => { volume[g] = 0; direct[g] = 0; });
  (r.templateSessions || []).forEach((s) => {
    perSession[s.id] = {};
    Object.keys(GROUPS).forEach((g) => { perSession[s.id][g] = 0; });
    s.items.forEach((it) => {
      if (it.kind !== 'strength') return;
      const ex = exerciseById(it.exerciseId);
      if (!ex) return;
      Object.entries(GROUPS).forEach(([g, def]) => {
        const c = contribution(ex, def.muscles);
        volume[g] += c * (Number(it.sets) || 0);
        if (c === 1) {
          direct[g] += Number(it.sets) || 0;
          perSession[s.id][g] += Number(it.sets) || 0;
        }
      });
    });
  });
  return { volume, direct, perSession };
}

const sessionSets = (s) => s.items.reduce((a, it) => a + (it.kind === 'strength' ? Number(it.sets) || 0 : 0), 0);

// Añade un ejercicio a la sesión indicada (o a la de menos series).
function addExercise(r, exerciseId, exerciseById, profile, sessionId) {
  const ex = exerciseById(exerciseId);
  if (!ex) return r;
  const next = clone(r);
  const target = sessionId
    ? next.templateSessions.find((s) => s.id === sessionId)
    : [...next.templateSessions].filter((s) => s.items.length).sort((a, b) => sessionSets(a) - sessionSets(b))[0] || next.templateSessions[0];
  if (!target) return r;
  target.items.push(newStrengthItem(ex, profile));
  return next;
}

// Sesión donde más se trabaja un conjunto de grupos (para colocar un ejercicio compensatorio).
function busiestSession(r, stats, groups) {
  return [...r.templateSessions].sort((a, b) => groups.reduce((x, g) => x + stats.perSession[b.id][g], 0) - groups.reduce((x, g) => x + stats.perSession[a.id][g], 0))[0]?.id;
}

export function proposeImprovements(routine, exerciseById, { profile, ignored = [] } = {}) {
  const r = routine;
  const steps = [];
  const add = (step) => { if (!ignored.includes(step.key)) steps.push(step); };
  const weekly = r.mode === 'weekly';
  const sessions = orderedSessions(r);
  const exOf = (it) => (it.kind === 'strength' ? exerciseById(it.exerciseId) : null);
  const nm = (ex) => ex?.displayName || ex?.name || 'Ejercicio';

  // Recoge los sitios donde se cumple una condición sobre un ítem.
  const where = (pred) => {
    const out = [];
    sessions.forEach((s) => s.items.forEach((it) => {
      const ex = exOf(it);
      if (it.kind === 'strength' && ex && pred(it, ex)) out.push(`${placeOf(r, s)}: ${nm(ex)}`);
    }));
    return out;
  };

  // ---- Por sesión, agregado en toda la rutina ----
  const empty = sessions.filter((s) => !s.items.length);
  if (empty.length) add({
    key: 'empty', level: 'error', title: 'Sesiones vacías',
    why: 'No tienen ningún ejercicio, así que esos días no hay nada que hacer.',
    fix: weekly ? 'Pasarlas a descanso.' : 'Eliminarlas de la secuencia.',
    places: empty.map((s) => placeOf(r, s)),
    apply: (x) => {
      const next = clone(x);
      next.templateSessions = next.templateSessions.filter((s) => s.items.length);
      if (!weekly) next.templateSessions = next.templateSessions.sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
      return next;
    },
  });

  const missing = [];
  sessions.forEach((s) => s.items.forEach((it) => { if (it.kind === 'strength' && !exerciseById(it.exerciseId)) missing.push(placeOf(r, s)); }));
  if (missing.length) add({
    key: 'missing-exercise', level: 'error', title: 'Ejercicios que ya no existen',
    why: 'Están en la rutina pero ya no aparecen en el catálogo y no se podrán registrar.',
    fix: 'Quitarlos de la rutina.', places: missing,
    apply: (x) => {
      const next = clone(x);
      next.templateSessions.forEach((s) => { s.items = s.items.filter((it) => it.kind !== 'strength' || exerciseById(it.exerciseId)); });
      return next;
    },
  });

  const repeated = [];
  sessions.forEach((s) => {
    const seen = new Set();
    s.items.forEach((it) => {
      if (it.kind !== 'strength') return;
      if (seen.has(it.exerciseId)) repeated.push(`${placeOf(r, s)}: ${nm(exOf(it))}`);
      seen.add(it.exerciseId);
    });
  });
  if (repeated.length) add({
    key: 'repeated', level: 'warn', title: 'Ejercicio repetido en la misma sesión',
    why: 'La segunda vez rinde peor por la fatiga y no aporta un estímulo distinto.',
    fix: 'Juntar las series en el primero (máximo 6).', places: repeated,
    apply: (x) => {
      const next = clone(x);
      next.templateSessions.forEach((s) => {
        const first = new Map();
        s.items = s.items.filter((it) => {
          if (it.kind !== 'strength') return true;
          const f = first.get(it.exerciseId);
          if (!f) { first.set(it.exerciseId, it); return true; }
          const total = Math.min(6, f.sets + it.sets);
          while (f.sets < total) Object.assign(f, addSet(f));
          return false;
        });
      });
      return next;
    },
  });

  const inverted = where((it) => Number(it.repMin) > Number(it.repMax));
  if (inverted.length) add({
    key: 'rep-inverted', level: 'error', title: 'Rango de repeticiones invertido',
    why: 'El mínimo es mayor que el máximo, así que la progresión no sabe cuándo subir peso.',
    fix: 'Intercambiar mínimo y máximo.', places: inverted,
    apply: (x) => mapStrength(x, (it) => (Number(it.repMin) > Number(it.repMax) ? { ...it, repMin: it.repMax, repMax: it.repMin } : it), exerciseById),
  });

  const heavyShort = (it) => Number(it.repMax) <= 6 && Number(it.restSec) > 0 && Number(it.restSec) < 120;
  const shortRest = where(heavyShort);
  if (shortRest.length) add({
    key: 'short-rest-heavy', level: 'warn', title: 'Descanso corto en ejercicios pesados',
    why: 'Con 6 repeticiones o menos el peso es alto y con menos de 2 minutos no recuperas: la siguiente serie sale peor.',
    fix: 'Subir el descanso a 2 min 30 s en esos ejercicios.', places: shortRest,
    apply: (x) => mapStrength(x, (it) => (heavyShort(it) ? { ...it, restSec: 150 } : it), exerciseById),
  });

  const manyReps = where((it) => Number(it.repMax) > 30);
  if (manyReps.length) add({
    key: 'too-many-reps', level: 'tip', title: 'Demasiadas repeticiones',
    why: 'Por encima de 30 repeticiones la serie es más resistencia que estímulo de fuerza o músculo.',
    fix: 'Usa más peso o una variante más dura para trabajar en 8–20 repeticiones. Este cambio lo decides tú en cada ejercicio.',
    places: manyReps, apply: null,
  });

  const manySets = where((it) => Number(it.sets) > 6);
  if (manySets.length) add({
    key: 'too-many-sets', level: 'warn', title: 'Más de 6 series en un ejercicio',
    why: 'Pasadas 5–6 series del mismo ejercicio, las últimas aportan muy poco y acumulan fatiga.',
    fix: 'Dejarlos en 4 series.', places: manySets,
    apply: (x) => mapStrength(x, (it) => (Number(it.sets) > 6 ? trimSets(it, 4) : it), exerciseById),
  });

  const longRest = where((it) => Number(it.restSec) > 300);
  if (longRest.length) add({
    key: 'long-rest', level: 'tip', title: 'Descansos muy largos',
    why: 'Más de 5 minutos alargan la sesión sin ventaja clara.',
    fix: 'Bajar el descanso a 3 minutos.', places: longRest,
    apply: (x) => mapStrength(x, (it) => (Number(it.restSec) > 300 ? { ...it, restSec: 180 } : it), exerciseById),
  });

  const cardioFirst = sessions.filter((s) => s.items.some((it, i) => it.kind === 'cardio' && (Number(it.minutes) || 0) >= 15 && s.items.slice(i + 1).some((x) => x.kind === 'strength')));
  if (cardioFirst.length) add({
    key: 'cardio-first', level: 'tip', title: 'Cardio largo antes de las pesas',
    why: 'Llegas cansado a los ejercicios de fuerza y rindes menos.',
    fix: 'Mover el cardio al final de la sesión.', places: cardioFirst.map((s) => placeOf(r, s)),
    apply: (x) => {
      const next = clone(x);
      next.templateSessions.forEach((s) => {
        const long = s.items.filter((it) => it.kind === 'cardio' && (Number(it.minutes) || 0) >= 15);
        if (long.length) s.items = [...s.items.filter((it) => !long.includes(it)), ...long];
      });
      return next;
    },
  });

  const badOrder = sessions.filter((s) => {
    let isoSeen = false;
    return s.items.some((it) => {
      const ex = exOf(it);
      if (!ex) return false;
      if (isIsolation(ex)) isoSeen = true;
      return isoSeen && isCompound(ex);
    });
  });
  if (badOrder.length) add({
    key: 'order', level: 'tip', title: 'Orden de los ejercicios',
    why: 'Si cansas antes los músculos pequeños, rindes menos en los ejercicios grandes, que son los que más progreso dan.',
    fix: 'Poner los multiarticulares antes que los de aislamiento (el resto mantiene su orden).',
    places: badOrder.map((s) => placeOf(r, s)),
    apply: (x) => {
      const next = clone(x);
      next.templateSessions.forEach((s) => {
        const slots = s.items.map((it, i) => (it.kind === 'strength' ? i : -1)).filter((i) => i >= 0);
        const strength = slots.map((i) => s.items[i]);
        const rank = (it) => { const ex = exOf(it); return ex && isCompound(ex) ? 0 : ex && isIsolation(ex) ? 2 : 1; };
        const sorted = strength.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i).map((o) => o.it);
        slots.forEach((slot, k) => { s.items[slot] = sorted[k]; });
      });
      return next;
    },
  });

  const bigSessions = sessions.filter((s) => sessionSets(s) > 30);
  if (bigSessions.length) add({
    key: 'session-sets', level: 'warn', title: 'Sesiones con más de 30 series',
    why: 'La calidad cae al final y cuesta recuperar.',
    fix: 'Quitar una serie a los ejercicios de aislamiento (mínimo 2) hasta quedar en ~28.',
    places: bigSessions.map((s) => `${placeOf(r, s)} (${sessionSets(s)} series)`),
    apply: (x) => {
      const next = clone(x);
      next.templateSessions.forEach((s) => {
        let guard = 50;
        while (sessionSets(s) > 28 && guard--) {
          const cand = s.items.filter((it) => it.kind === 'strength' && it.sets > 2).sort((a, b) => (isIsolation(exOf(b) || {}) ? 1 : 0) - (isIsolation(exOf(a) || {}) ? 1 : 0) || b.sets - a.sets)[0];
          if (!cand) break;
          Object.assign(cand, trimSets(cand, cand.sets - 1));
        }
      });
      return next;
    },
  });

  const longSessions = sessions.filter((s) => sessionMinutes(s) > 100);
  if (longSessions.length) add({
    key: 'session-long', level: 'warn', title: 'Sesiones de más de 100 minutos',
    why: 'Son difíciles de mantener y el rendimiento cae en la última parte.',
    fix: 'Descanso máximo de 75 s en aislamiento y 2 min 30 s en el resto.',
    places: longSessions.map((s) => `${placeOf(r, s)} (~${Math.round(sessionMinutes(s))} min)`),
    apply: (x) => {
      const ids = new Set(longSessions.map((s) => s.id));
      const next = clone(x);
      next.templateSessions.forEach((s) => {
        if (!ids.has(s.id)) return;
        s.items = s.items.map((it) => {
          if (it.kind !== 'strength') return it;
          const cap = isIsolation(exOf(it) || {}) ? 75 : 150;
          return Number(it.restSec) > cap ? { ...it, restSec: cap } : it;
        });
      });
      return next;
    },
  });

  const single = sessions.filter((s) => s.items.length === 1 && s.items[0].kind === 'strength');
  if (single.length) add({
    key: 'single', level: 'tip', title: 'Sesiones con un solo ejercicio',
    why: 'Es poco estímulo para el tiempo de desplazamiento y calentamiento.',
    fix: 'Añade 2–4 ejercicios o júntala con otra sesión. Esto lo decides tú.',
    places: single.map((s) => placeOf(r, s)), apply: null,
  });

  // ---- Volumen y equilibrio de toda la rutina ----
  const strengthCount = sessions.reduce((a, s) => a + s.items.filter((it) => it.kind === 'strength' && exOf(it)).length, 0);
  if (strengthCount) {
    const stats = groupStats(r, exerciseById);
    const period = weekly ? 'a la semana' : 'por ciclo';
    Object.entries(GROUPS).forEach(([g, def]) => {
      const v = stats.volume[g];
      const sug = exerciseById(SUGGESTED[g]);
      const sugName = sug ? nm(sug) : def.suggest;
      if (def.major && v === 0) {
        add({
          key: `missing:${g}`, level: 'warn', title: `Sin trabajo de ${def.label.toLowerCase()}`,
          why: `Ningún ejercicio trabaja ${def.label.toLowerCase()}. Un grupo grande sin entrenar provoca descompensaciones.`,
          fix: `Añadir ${sugName} (3 series) en la sesión con menos series.`, places: [],
          apply: sug ? (x) => addExercise(x, SUGGESTED[g], exerciseById, profile) : null,
        });
      } else if (def.major && v < 6) {
        const trains = (it, ex) => contribution(ex, def.muscles) === 1;
        const hasDirect = where(trains).length > 0;
        add({
          key: `low:${g}`, level: 'tip', title: `Poco volumen de ${def.label.toLowerCase()}`,
          why: `${r1(v)} series ${period}. Para ganar músculo suelen hacer falta unas 10–20 series semanales por grupo.`,
          fix: hasDirect ? 'Añadir una serie a cada ejercicio que lo trabaja como principal (máximo 5).' : `Añadir ${sugName} (3 series).`,
          places: where(trains),
          apply: hasDirect
            ? (x) => mapStrength(x, (it, ex) => (ex && trains(it, ex) && it.sets < 5 ? addSet(it) : it), exerciseById)
            : sug ? (x) => addExercise(x, SUGGESTED[g], exerciseById, profile) : null,
        });
      } else if (!def.major && !def.small && v === 0) {
        add({
          key: `nodirect:${g}`, level: 'tip', title: `${def.label} sin trabajo directo`,
          why: `No hay ningún ejercicio para ${def.label.toLowerCase()}.`,
          fix: `Si te interesa desarrollarlos, añadir ${sugName} (3 series).`, places: [],
          apply: sug ? (x) => addExercise(x, SUGGESTED[g], exerciseById, profile) : null,
        });
      }
      const limit = def.small ? 16 : 22;
      if (stats.direct[g] > limit) {
        const trains = (it, ex) => contribution(ex, def.muscles) === 1;
        add({
          key: `excess:${g}`, level: 'warn', title: `Demasiado volumen de ${def.label.toLowerCase()}`,
          why: `${r1(stats.direct[g])} series directas ${period}: por encima de ~20 la recuperación empeora y no se gana más.`,
          fix: `Quitar series (mínimo 2 por ejercicio) hasta quedar en ${limit - 2}.`, places: where(trains),
          apply: (x) => {
            const next = clone(x);
            const items = next.templateSessions.flatMap((s) => s.items).filter((it) => it.kind === 'strength' && exOf(it) && trains(it, exOf(it)));
            let total = items.reduce((a, it) => a + it.sets, 0);
            let guard = 100;
            while (total > limit - 2 && guard--) {
              const cand = items.filter((it) => it.sets > 2).sort((a, b) => b.sets - a.sets)[0];
              if (!cand) break;
              Object.assign(cand, trimSets(cand, cand.sets - 1));
              total -= 1;
            }
            return next;
          },
        });
      }
    });

    const push = stats.direct.chest + stats.direct.shoulders * 0.5;
    const pull = stats.direct.back;
    if (push > 0 && push > pull * 1.5 + 2) add({
      key: 'push-pull', level: 'warn', title: 'Más empuje que tirón',
      why: `Haces bastante más empuje (${r1(push)} series de pecho/hombro) que tirón (${r1(pull)} de espalda). A la larga adelanta los hombros y aumenta el riesgo de molestias.`,
      fix: `Añadir ${nm(exerciseById(ROW))} (3 series) en la sesión con más empuje.`, places: [],
      apply: (x) => addExercise(x, ROW, exerciseById, profile, busiestSession(x, groupStats(x, exerciseById), ['chest', 'shoulders'])),
    });
    if (stats.direct.quads > 0 && stats.direct.quads > stats.direct.hamstrings * 2 + 2) add({
      key: 'quad-ham', level: 'warn', title: 'Cuádriceps descompensado',
      why: `Cuádriceps ${r1(stats.direct.quads)} series directas frente a ${r1(stats.direct.hamstrings)} de isquiotibiales. El desequilibrio carga la rodilla.`,
      fix: `Añadir ${nm(exerciseById(SUGGESTED.hamstrings))} (3 series) en la sesión con más cuádriceps.`, places: [],
      apply: (x) => addExercise(x, SUGGESTED.hamstrings, exerciseById, profile, busiestSession(x, groupStats(x, exerciseById), ['quads'])),
    });

    if (weekly) {
      if (new Set(sessions.map((s) => s.weekday)).size === 7) add({
        key: 'no-rest', level: 'warn', title: 'Sin días de descanso',
        why: 'El músculo crece mientras descansas; sin descanso se acumula fatiga.',
        fix: 'Deja al menos 1 día libre (mejor 2). Elige tú qué día pasar a descanso.', places: [], apply: null,
      });
      const byDay = new Map(sessions.map((s) => [s.weekday, stats.perSession[s.id]]));
      Object.entries(GROUPS).forEach(([g, def]) => {
        if (!def.major) return;
        const pairs = [];
        for (let d = 0; d < 7; d++) {
          const a = byDay.get(d);
          const b = byDay.get((d + 1) % 7);
          if (a && b && a[g] >= 4 && b[g] >= 4) pairs.push(`${WEEKDAYS[d]} y ${WEEKDAYS[(d + 1) % 7].toLowerCase()}`);
        }
        if (pairs.length) add({
          key: `consecutive:${g}`, level: 'warn', title: `${def.label} dos días seguidos`,
          why: `${def.label} necesita ~48 h para recuperarse; el segundo día rindes peor.`,
          fix: 'Separa esas sesiones con un día entre medias o cambia el orden de los días.', places: pairs, apply: null,
        });
        const daysHit = sessions.filter((s) => stats.perSession[s.id][g] >= 2).length;
        if (sessions.length >= 3 && stats.direct[g] >= 10 && daysHit === 1) add({
          key: `one-day:${g}`, level: 'tip', title: `${def.label} solo un día`,
          why: `Todas las series de ${def.label.toLowerCase()} van en un único día. Repartidas en 2 días se rinde mejor con el mismo volumen.`,
          fix: 'Pasa parte de los ejercicios a otra sesión de la semana.', places: [], apply: null,
        });
      });
    }
  }

  const order = { error: 0, warn: 1, tip: 2 };
  return steps.sort((a, b) => order[a.level] - order[b.level]);
}
