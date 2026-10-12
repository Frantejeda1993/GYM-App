// Tipos de carga. Se guarda siempre el valor "real":
// - barbell: total (por lado × 2 + barra)
// - dumbbell: kg por mano
// - total: kg totales (máquina, polea, otros)
// - bodyweight: lastre en kg
export const LOAD_TYPES = {
  barbell: { label: 'Barra (kg por lado)', short: 'Barra', input: 'kg por lado', increment: 2.5 },
  dumbbell: { label: 'Mancuerna (kg por mano)', short: 'Mancuerna', input: 'kg por mano', increment: 2 },
  total: { label: 'Máquina / polea (kg total)', short: 'Máquina', input: 'kg total', increment: 5 },
  bodyweight: { label: 'Peso corporal (+ lastre)', short: 'Peso corporal', input: 'lastre kg', increment: 2.5 },
};

export const LOAD_TYPE_KEYS = Object.keys(LOAD_TYPES);

const round = (n) => Math.round(n * 100) / 100;

// Valor que el usuario escribe → valor guardado.
export function inputToStored(value, loadType, barKg = 0) {
  const v = Number(value) || 0;
  if (loadType === 'barbell') return round(v * 2 + (Number(barKg) || 0));
  return round(v);
}

// Valor guardado → valor que el usuario ve y edita.
export function storedToInput(stored, loadType, barKg = 0) {
  const s = Number(stored) || 0;
  if (loadType === 'barbell') return round(Math.max(0, (s - (Number(barKg) || 0)) / 2));
  return round(s);
}

const fmt = (n) => String(round(n)).replace('.', ',');

// Texto legible: "20 kg por lado (60 kg total)", "20 kg por mancuerna", etc.
export function describeLoad(stored, loadType, barKg = 0) {
  const s = Number(stored) || 0;
  switch (loadType) {
    case 'barbell':
      return `${fmt(storedToInput(s, loadType, barKg))} kg por lado · ${fmt(s)} kg total`;
    case 'dumbbell':
      return `${fmt(s)} kg por mancuerna`;
    case 'bodyweight':
      return s > 0 ? `Peso corporal + ${fmt(s)} kg` : 'Peso corporal';
    default:
      return `${fmt(s)} kg`;
  }
}
