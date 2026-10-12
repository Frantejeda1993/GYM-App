// Equipamiento (claves de free-exercise-db) con etiqueta en español y tipo de carga por defecto.
export const EQUIPMENT = {
  barbell: { label: 'Barra', loadType: 'barbell' },
  'e-z curl bar': { label: 'Barra Z', loadType: 'barbell' },
  dumbbell: { label: 'Mancuerna', loadType: 'dumbbell' },
  kettlebells: { label: 'Kettlebell', loadType: 'dumbbell' },
  machine: { label: 'Máquina', loadType: 'total' },
  cable: { label: 'Polea', loadType: 'total' },
  'body only': { label: 'Peso corporal', loadType: 'bodyweight' },
  bands: { label: 'Bandas', loadType: 'total' },
  'medicine ball': { label: 'Balón medicinal', loadType: 'total' },
  'exercise ball': { label: 'Fitball', loadType: 'total' },
  'foam roll': { label: 'Rodillo', loadType: 'total' },
  other: { label: 'Otro', loadType: 'total' },
};

export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT);
export const equipmentLabel = (k) => EQUIPMENT[k]?.label || 'Otro';
