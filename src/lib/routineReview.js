import { WEEKDAYS } from './routine';

// Grupos musculares que se revisan. Un ejercicio aporta 1 serie al grupo si lo trabaja como
// principal y 0,5 si es secundario (lo mismo que el dashboard muscular).
const GROUPS = {
  chest: { label: 'Pecho', muscles: ['chest'], major: true, suggest: 'press de banca, press inclinado con mancuernas o aperturas' },
  back: { label: 'Espalda', muscles: ['lats', 'middle back'], major: true, suggest: 'jalón al pecho, dominadas o remo' },
  shoulders: { label: 'Hombros', muscles: ['shoulders'], major: true, suggest: 'press militar, elevaciones laterales o face pull' },
  quads: { label: 'Cuádriceps', muscles: ['quadriceps'], major: true, suggest: 'sentadilla, prensa o zancadas' },
  hamstrings: { label: 'Isquiotibiales', muscles: ['hamstrings'], major: true, suggest: 'peso muerto rumano o curl femoral' },
  glutes: { label: 'Glúteos', muscles: ['glutes'], suggest: 'hip thrust, puente de glúteo o zancadas' },
  biceps: { label: 'Bíceps', muscles: ['biceps'], suggest: 'curl con barra o mancuernas' },
  triceps: { label: 'Tríceps', muscles: ['triceps'], suggest: 'extensiones en polea o fondos' },
  calves: { label: 'Gemelos', muscles: ['calves'], small: true, suggest: 'elevaciones de talones' },
  abs: { label: 'Abdominales', muscles: ['abdominals'], small: true, suggest: 'crunch en polea, plancha o elevaciones de piernas' },
};
const SMALL_ISOLATION = new Set(['biceps', 'triceps', 'calves', 'abdominals', 'forearms']);

function contribution(ex, muscles) {
  if ((ex.primaryMuscles || []).some((m) => muscles.includes(m))) return 1;
  if ((ex.secondaryMuscles || []).some((m) => muscles.includes(m))) return 0.5;
  return 0;
}

// Multiarticular: trabaja varios grupos (p. ej. sentadilla, press, remo).
const isCompound = (ex) => (ex.primaryMuscles || []).length + (ex.secondaryMuscles || []).length >= 3;
const isIsolation = (ex) => (ex.primaryMuscles || []).length === 1 && SMALL_ISOLATION.has(ex.primaryMuscles[0]) && (ex.secondaryMuscles || []).length <= 1;

const r1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Minutos estimados: cada serie ~40 s de trabajo más su descanso; el cardio, sus minutos.
function sessionMinutes(s) {
  return (s.items || []).reduce((a, it) => {
    if (it.kind === 'cardio') return a + (Number(it.minutes) || 0);
    const sets = Number(it.sets) || 0;
    return a + (sets * (40 + (Number(it.restSec) || 0))) / 60;
  }, 0);
}

// Revisa una rutina y devuelve fallos y sugerencias con el porqué y cómo arreglarlo.
// level: 'error' (está mal), 'warn' (conviene cambiarlo), 'tip' (mejora opcional).
export function reviewRoutine(routine, exerciseById) {
  const issues = [];
  const add = (level, title, why, fix, where) => issues.push({ level, title, why, fix, where });
  const weekly = routine.mode === 'weekly';
  const sessions = [...(routine.templateSessions || [])].sort((a, b) => (weekly ? a.weekday - b.weekday : a.order - b.order));
  const nameOf = (s) => (weekly ? `${WEEKDAYS[s.weekday]} · ${s.name}` : s.name);

  const zero = () => Object.fromEntries(Object.keys(GROUPS).map((g) => [g, 0]));
  // volume: total (secundario cuenta 0,5); direct: solo como músculo principal, para fatiga y excesos
  const volume = zero();
  const direct = zero();
  const perSession = sessions.map(zero);
  let strengthCount = 0;

  sessions.forEach((s, si) => {
    const items = s.items || [];
    const where = nameOf(s);
    if (!items.length) {
      add('error', 'Sesión vacía', 'No tiene ningún ejercicio, así que ese día no hay nada que hacer.', weekly ? 'Añade ejercicios o márcalo como descanso.' : 'Añade ejercicios o elimina la sesión.', where);
      return;
    }

    const seen = new Set();
    let cardioBeforeStrength = false;
    let isolationBeforeCompound = null;
    let sessionSets = 0;

    items.forEach((it, ii) => {
      if (it.kind === 'cardio') {
        if ((Number(it.minutes) || 0) >= 15 && items.slice(ii + 1).some((x) => x.kind === 'strength')) cardioBeforeStrength = true;
        return;
      }
      const ex = exerciseById(it.exerciseId);
      if (!ex) {
        add('error', 'Ejercicio no disponible', 'Uno de los ejercicios ya no existe en el catálogo y no se podrá registrar.', 'Ábrelo y elimínalo o cámbialo por otro.', where);
        return;
      }
      strengthCount += 1;
      const sets = Number(it.sets) || 0;
      sessionSets += sets;
      const nm = ex.displayName || ex.name;
      if (seen.has(ex.id)) add('warn', `${nm} repetido`, 'El mismo ejercicio aparece dos veces en la sesión: el segundo rinde peor por la fatiga y no aporta un estímulo distinto.', 'Junta las series en uno solo o cambia el segundo por una variante (otro ángulo o agarre).', where);
      seen.add(ex.id);
      if (isCompound(ex) && ii > 0 && !isolationBeforeCompound) {
        const prevIso = items.slice(0, ii).map((x) => x.kind === 'strength' && exerciseById(x.exerciseId)).find((p) => p && isIsolation(p));
        if (prevIso) isolationBeforeCompound = [prevIso, ex];
      }

      const repMin = Number(it.repMin) || 0;
      const repMax = Number(it.repMax) || 0;
      const rest = Number(it.restSec) || 0;
      if (repMin > repMax) add('error', `${nm}: rango de repeticiones invertido`, `El mínimo (${repMin}) es mayor que el máximo (${repMax}), así que la progresión no sabrá cuándo subir peso.`, 'Corrige el rango para que el mínimo sea menor que el máximo.', where);
      if (repMax <= 6 && rest > 0 && rest < 120) add('warn', `${nm}: descanso corto para pocas repeticiones`, `Con series de ${repMin}–${repMax} repeticiones el peso es alto y ${rest} s no bastan para recuperar: la siguiente serie sale peor.`, 'Descansa 2–3 minutos en los ejercicios pesados.', where);
      if (repMax > 30) add('tip', `${nm}: demasiadas repeticiones`, 'Por encima de 30 repeticiones la serie se convierte más en resistencia que en estímulo de fuerza o músculo, y es difícil llegar cerca del fallo.', 'Sube la dificultad (más peso o una variante más dura) para trabajar en 8–20 repeticiones.', where);
      if (sets > 6) add('warn', `${nm}: ${sets} series en un ejercicio`, 'Pasadas 5–6 series del mismo ejercicio, las últimas aportan muy poco y acumulan fatiga.', 'Deja 3–4 series y pasa el resto a otro ejercicio del mismo músculo.', where);
      if (rest > 300) add('tip', `${nm}: descanso muy largo`, `${Math.round(rest / 60)} minutos alargan la sesión sin ventaja clara.`, 'Con 2–3 minutos basta incluso en los ejercicios más pesados.', where);

      Object.entries(GROUPS).forEach(([g, def]) => {
        const c = contribution(ex, def.muscles);
        volume[g] += c * sets;
        if (c === 1) {
          direct[g] += sets;
          perSession[si][g] += sets;
        }
      });
    });

    if (cardioBeforeStrength) add('tip', 'Cardio antes de las pesas', 'Hacer cardio largo primero te cansa y rindes menos en los ejercicios de fuerza.', 'Pasa el cardio al final de la sesión (o haz solo 5–10 min suaves de calentamiento).', where);
    if (isolationBeforeCompound) {
      const [iso, comp] = isolationBeforeCompound;
      add('tip', 'Orden de los ejercicios', `${iso.displayName || iso.name} va antes que ${comp.displayName || comp.name}: si cansas antes los músculos pequeños, rindes menos en el ejercicio grande, que es el que más progreso da.`, 'Ordena de multiarticulares (pesados) a aislamiento.', where);
    }
    if (sessionSets > 30) add('warn', `${sessionSets} series en una sesión`, 'Más de 25–30 series efectivas por sesión hacen que la calidad caiga al final y cueste recuperar.', 'Reparte ejercicios en otros días o quita series de los accesorios.', where);
    const min = sessionMinutes(s);
    if (min > 100) add('warn', `Sesión de ~${Math.round(min)} min`, 'Una sesión tan larga es difícil de mantener y el rendimiento cae en la última parte.', 'Reduce descansos de los accesorios, quita algún ejercicio o reparte en más días.', where);
    if (items.length === 1 && items[0].kind === 'strength') add('tip', 'Solo un ejercicio', 'La sesión tiene un único ejercicio: es poco estímulo para el tiempo de desplazamiento y calentamiento.', 'Añade 2–4 ejercicios más o júntala con otra sesión.', where);
  });

  if (!strengthCount) return { issues, volume, direct, groups: GROUPS, empty: true };

  // Volumen semanal por grupo
  const period = weekly ? 'a la semana' : 'por ciclo';
  Object.entries(GROUPS).forEach(([g, def]) => {
    const v = volume[g];
    if (def.major && v === 0) add('warn', `Sin trabajo de ${def.label.toLowerCase()}`, `Ningún ejercicio trabaja ${def.label.toLowerCase()}. Un grupo grande sin entrenar provoca descompensaciones y frena el progreso general.`, `Añade ${def.suggest}.`);
    else if (def.major && v < 6) add('tip', `Poco volumen de ${def.label.toLowerCase()}`, `${r1(v)} series ${period}. Para ganar músculo suelen hacer falta unas 10–20 series semanales por grupo.`, `Añade series o un ejercicio más (${def.suggest}).`);
    else if (!def.major && !def.small && v === 0) add('tip', `${def.label} sin trabajo directo`, `No hay ningún ejercicio para ${def.label.toLowerCase()}.`, `Si te interesa desarrollarlos, añade ${def.suggest}.`);
    if (direct[g] > (def.small ? 16 : 22)) add('warn', `Demasiado volumen de ${def.label.toLowerCase()}`, `${r1(direct[g])} series directas ${period}: por encima de ~20 la recuperación empeora y no se gana más.`, 'Quita series o algún ejercicio de ese grupo.');
  });

  // Equilibrios
  const push = direct.chest + direct.shoulders * 0.5;
  const pull = direct.back;
  if (push > 0 && push > pull * 1.5 + 2) add('warn', 'Más empuje que tirón', `Haces bastante más empuje (${r1(push)} series de pecho/hombro) que tirón (${r1(pull)} de espalda). A la larga adelanta los hombros y aumenta el riesgo de molestias.`, 'Iguala con remos o jalones: al menos tantas series de tirón como de empuje.');
  if (direct.quads > 0 && direct.quads > direct.hamstrings * 2 + 2) add('warn', 'Cuádriceps descompensado', `Cuádriceps ${r1(direct.quads)} series directas frente a ${r1(direct.hamstrings)} de isquiotibiales. El desequilibrio carga la rodilla.`, 'Añade peso muerto rumano o curl femoral.');

  if (weekly) {
    const days = new Set(sessions.map((s) => s.weekday));
    if (days.size === 7) add('warn', 'Sin días de descanso', 'Entrenas los 7 días: el músculo crece mientras descansas, y sin descanso se acumula fatiga.', 'Deja al menos 1 día libre (mejor 2).');

    // Mismo grupo grande fuerte en días seguidos (domingo → lunes incluido)
    const byDay = new Map(sessions.map((s, i) => [s.weekday, perSession[i]]));
    const flagged = new Set();
    for (let d = 0; d < 7; d++) {
      const a = byDay.get(d);
      const b = byDay.get((d + 1) % 7);
      if (!a || !b) continue;
      Object.entries(GROUPS).forEach(([g, def]) => {
        if (def.major && !flagged.has(g) && a[g] >= 4 && b[g] >= 4) {
          flagged.add(g);
          add('warn', `${def.label} dos días seguidos`, `${WEEKDAYS[d]} y ${WEEKDAYS[(d + 1) % 7].toLowerCase()} trabajan fuerte ${def.label.toLowerCase()}: necesita ~48 h para recuperarse y el segundo día rendirás peor.`, 'Separa esas sesiones con un día entre medias o cambia el orden de los días.');
        }
      });
    }

    // Frecuencia: grupo grande concentrado en un solo día
    if (sessions.length >= 3) {
      Object.entries(GROUPS).forEach(([g, def]) => {
        const daysHit = perSession.filter((p) => p[g] >= 2).length;
        if (def.major && direct[g] >= 10 && daysHit === 1) add('tip', `${def.label} solo un día`, `Todas las series de ${def.label.toLowerCase()} van en un único día. Repartidas en 2 días se rinde mejor y se gana más con el mismo volumen.`, 'Pasa parte de los ejercicios a otra sesión de la semana.');
      });
    }
  }

  const order = { error: 0, warn: 1, tip: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return { issues, volume, direct, groups: GROUPS, empty: false };
}
