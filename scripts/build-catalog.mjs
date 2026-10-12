// Genera src/data/exercises.json a partir de free-exercise-db (dominio público).
// Uso: node scripts/build-catalog.mjs <ruta a free-exercise-db/dist/exercises.json>
// Fuente: https://github.com/yuhonas/free-exercise-db
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('Falta la ruta a exercises.json');
  process.exit(1);
}

const EXCLUDED = new Set(['stretching', 'cardio']);

function loadTypeFor(equipment) {
  switch (equipment) {
    case 'barbell':
      return { l: 'barbell', b: 20 };
    case 'e-z curl bar':
      return { l: 'barbell', b: 10 };
    case 'dumbbell':
    case 'kettlebells':
      return { l: 'dumbbell' };
    case 'body only':
      return { l: 'bodyweight' };
    default:
      return { l: 'total' };
  }
}

const raw = JSON.parse(readFileSync(src, 'utf8'));
const out = raw
  .filter((x) => !EXCLUDED.has(x.category))
  .map((x) => ({
    id: x.id,
    n: x.name,
    p: x.primaryMuscles,
    s: x.secondaryMuscles,
    e: x.equipment || 'other',
    ...loadTypeFor(x.equipment),
    // número de imágenes disponibles en public/ex (generadas con build-thumbs.py)
    i: ['0', '1'].filter((f) => existsSync(`public/ex/${x.id}-${f}.webp`)).length,
  }))
  .sort((a, b) => a.n.localeCompare(b.n));

writeFileSync('src/data/exercises.json', JSON.stringify(out));
console.log(`${out.length} ejercicios escritos en src/data/exercises.json`);
