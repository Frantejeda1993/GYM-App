// Claves en inglés (las del catálogo free-exercise-db), etiquetas en español.
export const MUSCLES = {
  chest: 'Pecho',
  shoulders: 'Hombros',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  forearms: 'Antebrazos',
  lats: 'Dorsales',
  'middle back': 'Espalda media',
  'lower back': 'Lumbares',
  traps: 'Trapecios',
  neck: 'Cuello',
  abdominals: 'Abdominales',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Gemelos',
  adductors: 'Aductores',
  abductors: 'Abductores',
};

export const MUSCLE_KEYS = Object.keys(MUSCLES);

// Grupos pequeños: umbrales reducidos en el dashboard (fase 4).
export const SMALL_MUSCLES = new Set(['forearms', 'calves', 'abdominals', 'neck', 'abductors', 'adductors']);

export const muscleLabel = (k) => MUSCLES[k] || k;
