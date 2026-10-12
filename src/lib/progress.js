import { e1rm } from './progression';

// Historial de un ejercicio a partir de las sesiones finalizadas, de la más antigua a la más reciente.
// Cada punto: { date, sessionId, best1rm, bestSet, volume, maxReps, maxKg, sets }
export function exerciseHistory(sessions, exerciseId) {
  const points = [];
  sessions
    .filter((s) => s.status === 'done')
    .forEach((s) => {
      (s.entries || [])
        .filter((e) => e.exerciseId === exerciseId)
        .forEach((e) => {
          const done = e.sets.filter((x) => x.done);
          if (!done.length) return;
          let best1rm = null;
          let bestSet = null;
          done.forEach((x) => {
            const v = e1rm(x.kg, x.reps, e.loadType);
            if (v != null && (best1rm == null || v > best1rm)) {
              best1rm = v;
              bestSet = x;
            }
          });
          if (!bestSet) bestSet = [...done].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
          points.push({
            date: s.date,
            sessionId: s.id,
            loadType: e.loadType,
            barKg: e.barKg,
            best1rm: best1rm == null ? null : Math.round(best1rm * 10) / 10,
            bestSet,
            volume: Math.round(done.reduce((acc, x) => acc + x.kg * x.reps, 0)),
            maxReps: Math.max(...done.map((x) => x.reps)),
            maxKg: Math.max(...done.map((x) => x.kg)),
            sets: done.length,
          });
        });
    });
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Ejercicios entrenados, con su último registro, ordenados por fecha reciente.
export function trainedExercises(sessions) {
  const map = new Map();
  sessions
    .filter((s) => s.status === 'done')
    .forEach((s) => {
      (s.entries || []).forEach((e) => {
        if (!e.sets.some((x) => x.done)) return;
        const prev = map.get(e.exerciseId);
        if (!prev || prev.lastDate < s.date) map.set(e.exerciseId, { exerciseId: e.exerciseId, name: e.name, lastDate: s.date, count: (prev?.count || 0) + 1 });
        else prev.count += 1;
      });
    });
  return [...map.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
}
