// Progresión de carga (doble progresión) y 1RM estimado.

// 1RM estimado con la fórmula de Epley. No se calcula por encima de 12 reps
// (pierde precisión) ni para peso corporal sin lastre.
export function e1rm(kg, reps, loadType) {
  if (!reps || reps < 1 || reps > 12) return null;
  if (loadType === 'bodyweight' && !(kg > 0)) return null;
  if (!(kg > 0)) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

const doneSets = (entry) => (entry?.sets || []).filter((s) => s.done);

// ¿Alguna serie hecha quedó por debajo del mínimo?
const belowMin = (entry) => doneSets(entry).some((s) => s.reps < entry.repMin);

// Entrada de la sesión anterior finalizada del mismo ejercicio de la plantilla.
export function previousEntry(sessions, current, entry) {
  return sessions
    .filter((s) => s.status === 'done' && s.id !== current.id && s.date <= current.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((s) => (s.entries || []).find((e) => (entry.itemId && e.itemId === entry.itemId) || (!entry.itemId && e.exerciseId === entry.exerciseId)))
    .find(Boolean) || null;
}

// Regla:
// - Subir: todas las series hechas y en el máximo del rango (o más).
// - Bajar: alguna serie por debajo del mínimo en esta sesión y en la anterior.
export function progressionFor(item, entry, prev) {
  const inc = Number(item.incrementKg) || 0;
  const done = doneSets(entry);
  if (!inc || !done.length) return null;
  if (done.length === entry.sets.length && done.every((s) => s.reps >= item.repMax)) return { dir: 'up', delta: inc };
  if (belowMin(entry) && prev && belowMin(prev)) {
    const base = item.loadMode === 'progressive' ? Math.min(...(item.setLoads || [item.loadKg])) : item.loadKg;
    const floor = item.loadType === 'barbell' ? item.barKg || 0 : 0;
    if (base - inc < floor) return null;
    return { dir: 'down', delta: -inc };
  }
  return null;
}
