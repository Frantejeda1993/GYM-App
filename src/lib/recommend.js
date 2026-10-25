import { WEEKDAYS, newSession, newStrengthItem, newCardioItem } from './routine';
import { BMI_RANGES, rangeLabel, heightToCm } from './body';

export const GOALS = {
  musculo: { label: 'Ganar músculo', short: 'Músculo' },
  fuerza: { label: 'Ganar fuerza', short: 'Fuerza' },
  grasa: { label: 'Perder grasa', short: 'Perder grasa' },
  salud: { label: 'Salud y forma general', short: 'Salud' },
};
export const LEVELS = { beginner: 'Principiante', intermediate: 'Intermedio' };
export const EQUIPMENT = { gym: 'Gimnasio', dumbbells: 'Solo mancuernas' };

// Ejercicio por patrón de movimiento: gym (normal), easy (principiante o bajo impacto en gym), db (solo mancuernas).
const SLOTS = {
  squat: { main: true, gym: 'Barbell_Full_Squat', easy: 'Leg_Press', db: 'Goblet_Squat' },
  hinge: { main: true, gym: 'Romanian_Deadlift', db: 'Stiff-Legged_Dumbbell_Deadlift' },
  deadlift: { main: true, gym: 'Barbell_Deadlift', easy: 'Romanian_Deadlift', db: 'Stiff-Legged_Dumbbell_Deadlift' },
  legPress: { gym: 'Leg_Press', db: 'Dumbbell_Squat' },
  lunge: { gym: 'Dumbbell_Lunges', easy: 'Leg_Press', db: 'Dumbbell_Lunges', lowImpact: 'Leg_Press', dbLowImpact: 'Goblet_Squat' },
  hipThrust: { gym: 'Barbell_Hip_Thrust', db: 'Barbell_Glute_Bridge' },
  quadIso: { gym: 'Leg_Extensions' },
  hamCurl: { gym: 'Lying_Leg_Curls' },
  calf: { gym: 'Standing_Calf_Raises', db: 'Calf_Raise_On_A_Dumbbell' },
  hPush: { main: true, gym: 'Barbell_Bench_Press_-_Medium_Grip', easy: 'Machine_Bench_Press', db: 'Dumbbell_Bench_Press' },
  incPush: { main: true, gym: 'Incline_Dumbbell_Press', db: 'Incline_Dumbbell_Press' },
  vPush: { main: true, gym: 'Standing_Military_Press', easy: 'Dumbbell_Shoulder_Press', db: 'Seated_Dumbbell_Press' },
  hPull: { main: true, gym: 'Seated_Cable_Rows', db: 'One-Arm_Dumbbell_Row' },
  row: { main: true, gym: 'Bent_Over_Barbell_Row', easy: 'Seated_Cable_Rows', db: 'Bent_Over_Two-Dumbbell_Row' },
  vPull: { main: true, gym: 'Wide-Grip_Lat_Pulldown', db: 'Bent_Over_Two-Dumbbell_Row_With_Palms_In' },
  oneArmRow: { gym: 'One-Arm_Dumbbell_Row', db: 'One-Arm_Dumbbell_Row' },
  lateral: { gym: 'Side_Lateral_Raise', db: 'Side_Lateral_Raise' },
  rearDelt: { gym: 'Face_Pull', db: 'Reverse_Flyes' },
  fly: { gym: 'Cable_Crossover', db: 'Dumbbell_Flyes' },
  biceps: { gym: 'Barbell_Curl', easy: 'Dumbbell_Alternate_Bicep_Curl', db: 'Dumbbell_Alternate_Bicep_Curl' },
  hammer: { gym: 'Hammer_Curls', db: 'Hammer_Curls' },
  triceps: { gym: 'Triceps_Pushdown', db: 'Tricep_Dumbbell_Kickback' },
  core: { gym: 'Cable_Crunch', easy: 'Crunches', db: 'Crunches' },
};

// Sesiones por tipo (en orden de prioridad: un principiante hace las primeras).
const TEMPLATES = {
  fullA: ['Full body A', ['squat', 'hPush', 'hPull', 'hinge', 'lateral', 'core']],
  fullB: ['Full body B', ['deadlift', 'vPush', 'vPull', 'lunge', 'biceps', 'triceps']],
  fullC: ['Full body C', ['legPress', 'incPush', 'row', 'hamCurl', 'rearDelt', 'core']],
  upperA: ['Torso A', ['hPush', 'row', 'vPush', 'vPull', 'lateral', 'biceps', 'triceps']],
  lowerA: ['Pierna A', ['squat', 'hinge', 'lunge', 'hamCurl', 'calf', 'core']],
  upperB: ['Torso B', ['incPush', 'vPull', 'hPull', 'fly', 'rearDelt', 'hammer', 'triceps']],
  lowerB: ['Pierna B', ['deadlift', 'legPress', 'hipThrust', 'quadIso', 'calf', 'core']],
  push: ['Empuje', ['hPush', 'incPush', 'vPush', 'lateral', 'fly', 'triceps']],
  pull: ['Tirón', ['vPull', 'row', 'oneArmRow', 'rearDelt', 'biceps', 'hammer']],
  legs: ['Pierna', ['squat', 'hinge', 'quadIso', 'hamCurl', 'calf', 'core']],
};

// Reparto semanal según días disponibles (índice de día: 0 = lunes).
const SPLITS = {
  2: { label: 'Full body', days: [[0, 'fullA'], [3, 'fullB']] },
  3: { label: 'Full body', days: [[0, 'fullA'], [2, 'fullB'], [4, 'fullC']] },
  4: { label: 'Torso / pierna', days: [[0, 'upperA'], [1, 'lowerA'], [3, 'upperB'], [4, 'lowerB']] },
  5: { label: 'Torso / pierna + empuje / tirón / pierna', days: [[0, 'upperA'], [1, 'lowerA'], [3, 'push'], [4, 'pull'], [5, 'legs']] },
  6: { label: 'Empuje / tirón / pierna ×2', days: [[0, 'push'], [1, 'pull'], [2, 'legs'], [3, 'push'], [4, 'pull'], [5, 'legs']] },
};

// Series, repeticiones y descanso por objetivo, para ejercicios principales y accesorios.
const DOSE = {
  fuerza: { main: [4, 3, 6, 180], acc: [3, 8, 10, 90] },
  musculo: { main: [3, 6, 10, 120], acc: [3, 10, 15, 75] },
  grasa: { main: [3, 8, 12, 90], acc: [2, 12, 15, 60] },
  salud: { main: [3, 8, 12, 90], acc: [2, 12, 15, 60] },
};

export function bmiOf(weightKg, heightCm) {
  const cm = heightToCm(heightCm);
  if (!(weightKg > 0) || !cm) return null;
  const h = cm / 100;
  return weightKg / (h * h);
}

export function bmiLabel(bmi) {
  return bmi == null ? '' : rangeLabel(BMI_RANGES, bmi).toLowerCase();
}

const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Propone una rutina semanal a partir del perfil. Devuelve la rutina (borrador) y por qué es así.
export function recommendRoutine({ weightKg, heightCm, goal, days, level, equipment }, exerciseById, profile) {
  const bmi = bmiOf(weightKg, heightCm);
  const lowImpact = bmi != null && bmi >= 30;
  const beginner = level === 'beginner';
  const split = SPLITS[days] || SPLITS[3];
  const dose = DOSE[goal] || DOSE.musculo;

  const pick = (slotKey) => {
    const s = SLOTS[slotKey];
    if (equipment === 'dumbbells') return (lowImpact && s.dbLowImpact) || s.db || null;
    if (lowImpact && s.lowImpact) return s.lowImpact;
    return ((beginner || lowImpact) && s.easy) || s.gym;
  };

  const templateSessions = split.days.map(([weekday, tKey]) => {
    const [name, slots] = TEMPLATES[tKey];
    const used = new Set();
    const items = [];
    slots.slice(0, beginner ? 5 : slots.length).forEach((slotKey) => {
      const ex = exerciseById(pick(slotKey));
      if (!ex || used.has(ex.id)) return;
      used.add(ex.id);
      const [sets, repMin, repMax, restSec] = SLOTS[slotKey].main ? dose.main : dose.acc;
      items.push({ ...newStrengthItem(ex, profile), sets: beginner ? Math.min(sets, 3) : sets, repMin, repMax, restSec });
    });
    const cardioMin = goal === 'grasa' ? (lowImpact ? 30 : 25) : goal === 'salud' ? 20 : 0;
    if (cardioMin) items.push({ ...newCardioItem(), cardioType: lowImpact ? 'Bicicleta' : 'Cinta', minutes: cardioMin });
    return newSession(name, { weekday, items });
  });

  const why = [];
  why.push(`${days} días por semana → ${split.label} (${split.days.map(([d]) => WEEKDAYS[d].slice(0, 3).toLowerCase()).join(', ')}).`);
  const [ms, mlo, mhi] = dose.main;
  const [as, alo, ahi] = dose.acc;
  why.push(`${GOALS[goal]?.label || 'Objetivo'}: principales ${ms} × ${mlo}–${mhi}, accesorios ${as} × ${alo}–${ahi}.`);
  if (goal === 'fuerza') why.push('Descansos largos (3 min) en los básicos para rendir en cada serie.');
  if (goal === 'grasa') why.push('Se añade cardio al final de cada sesión. La pérdida de grasa depende sobre todo de un déficit calórico moderado; la fuerza sirve para no perder músculo.');
  if (goal === 'salud') why.push('Se añade cardio moderado al final de cada sesión.');
  if (bmi != null) {
    why.push(`IMC ${fmt(bmi)} (${bmiLabel(bmi)}).`);
    if (lowImpact) why.push('Se priorizan ejercicios y cardio de bajo impacto (prensa, bicicleta) para cuidar rodillas y espalda.');
    if (bmi < 18.5 && goal === 'grasa') why.push('Con un IMC bajo suele convenir más ganar músculo que perder peso.');
  }
  if (weightKg > 0) why.push(`Proteína orientativa: ${Math.round(weightKg * 1.6)}–${Math.round(weightKg * 2.2)} g al día (1,6–2,2 g por kg).`);
  if (beginner) why.push('Nivel principiante: menos ejercicios por sesión y máquinas en lugar de algunos básicos con barra.');
  why.push('Los pesos parten de 0 (o la barra vacía): ajústalos en la primera sesión con una carga que te deje 1–3 repeticiones en reserva.');

  return {
    routine: { name: `${GOALS[goal]?.short || 'Rutina'} · ${days} días`, mode: 'weekly', templateSessions, nextSequenceIndex: 0 },
    why,
  };
}
