import { describe, it, expect } from 'vitest';
import {
  computeChanges, applyChanges, defaultAccepted, defaultChoices, templateKey, lastTimeFor,
  kgFromSides, splitOf, buildSession,
} from '../sessions';
import { progressionFor } from '../progression';

const describe1 = (kg) => `${kg} kg`;

// Rutina con el mismo ejercicio (press banca) lunes y jueves, y curl el lunes.
function routine() {
  return {
    id: 'r1',
    mode: 'weekly',
    templateSessions: [
      {
        id: 'mon', name: 'Torso A', weekday: 0, items: [
          { id: 'i-bench-mon', kind: 'strength', exerciseId: 'bench', sets: 3, repMin: 5, repMax: 8, reps: null, loadKg: 60, barKg: 20, loadMode: 'fixed', setLoads: null, incrementKg: 2.5, restSec: 120 },
          { id: 'i-curl', kind: 'strength', exerciseId: 'curl', sets: 3, repMin: 8, repMax: 12, reps: null, loadKg: 12, barKg: 0, loadMode: 'fixed', setLoads: null, incrementKg: 2, restSec: 90 },
        ],
      },
      {
        id: 'thu', name: 'Torso B', weekday: 3, items: [
          { id: 'i-bench-thu', kind: 'strength', exerciseId: 'bench', sets: 4, repMin: 8, repMax: 12, reps: null, loadKg: 50, barKg: 20, loadMode: 'fixed', setLoads: null, incrementKg: 2.5, restSec: 90 },
        ],
      },
    ],
  };
}
const exercises = {
  bench: { id: 'bench', name: 'Bench', loadType: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [] },
  curl: { id: 'curl', name: 'Curl', loadType: 'dumbbell', primaryMuscles: ['biceps'], secondaryMuscles: [] },
};
const exById = (id) => exercises[id];
const loadTypeOf = (id) => exercises[id]?.loadType;

function sessionFor(r, tsId, mutate) {
  const s = { id: 's1', ...buildSession(r, r.templateSessions.find((t) => t.id === tsId), exById, new Date(2026, 9, 12)) };
  mutate(s);
  return s;
}
const entry = (s, exerciseId) => s.entries.find((e) => e.exerciseId === exerciseId);
const item = (ts, id) => ts.flatMap((t) => t.items).find((i) => i.id === id);
const finish = (r, s, opts = {}) => {
  const changes = computeChanges(s, r, describe1, opts.sessions || []);
  const accepted = opts.accepted || defaultAccepted(changes);
  const choices = { ...defaultChoices(changes), ...(opts.choices || {}) };
  return { changes, ts: applyChanges(r, s.templateSessionId, changes, accepted, choices, loadTypeOf) };
};

describe('peso fijo', () => {
  it('sube al mayor peso y propaga la misma subida a otros días', () => {
    const r = routine();
    const s = sessionFor(r, 'mon', (x) => entry(x, 'bench').sets.forEach((set) => { set.kg = 65; set.done = true; }));
    const { ts } = finish(r, s);
    expect(item(ts, 'i-bench-mon').loadKg).toBe(65);
    expect(item(ts, 'i-bench-thu').loadKg).toBe(55); // 50 + 5
  });

  it('una bajada no se aplica si no se acepta (ni se propaga)', () => {
    const r = routine();
    const s = sessionFor(r, 'mon', (x) => entry(x, 'bench').sets.forEach((set) => { set.kg = 55; set.done = true; }));
    const { ts, changes } = finish(r, s);
    expect(changes.find((c) => c.id === 'i-bench-mon:load').down).toBe(true);
    expect(ts).toBeNull();
  });

  it('pesos distintos en peso fijo: se ofrece elegir', () => {
    const r = routine();
    const kgs = [50, 55, 60];
    const s = sessionFor(r, 'mon', (x) => entry(x, 'bench').sets.forEach((set, i) => { set.kg = kgs[i]; set.done = true; }));
    const changes = computeChanges(s, r, describe1);
    const mixed = changes.find((c) => c.kind === 'mixed');
    expect(mixed.options.map((o) => o.key)).toEqual(['progressive', 'fixed', 'keep']);

    const prog = finish(r, s, { choices: { [mixed.id]: 'progressive' } }).ts;
    expect(item(prog, 'i-bench-mon')).toMatchObject({ loadMode: 'progressive', setLoads: [50, 55, 60], loadKg: 60 });

    const fixed = finish(r, s, { choices: { [mixed.id]: 'fixed' } }).ts;
    expect(item(fixed, 'i-bench-mon')).toMatchObject({ loadMode: 'fixed', loadKg: 60 });

    const keep = finish(r, s, { choices: { [mixed.id]: 'keep' } }).ts;
    expect(keep).toBeNull();
  });
});

describe('peso progresivo', () => {
  it('actualiza cada serie hecha', () => {
    const r = routine();
    Object.assign(r.templateSessions[0].items[0], { loadMode: 'progressive', setLoads: [50, 55, 60], loadKg: 60 });
    const s = sessionFor(r, 'mon', (x) => {
      const e = entry(x, 'bench');
      e.sets[2].kg = 62.5;
      e.sets.forEach((set) => { set.done = true; });
    });
    const { ts } = finish(r, s);
    expect(item(ts, 'i-bench-mon').setLoads).toEqual([50, 55, 62.5]);
    expect(item(ts, 'i-bench-thu').loadKg).toBe(52.5); // +2,5 del máximo
  });
});

describe('progresión', () => {
  it('sube el incremento al llegar al máximo, vuelve al mínimo y propaga', () => {
    const r = routine();
    const s = sessionFor(r, 'mon', (x) => entry(x, 'bench').sets.forEach((set) => { set.reps = 8; set.done = true; }));
    const { ts, changes } = finish(r, s);
    expect(changes.some((c) => c.kind === 'progression' && !c.down)).toBe(true);
    expect(item(ts, 'i-bench-mon')).toMatchObject({ loadKg: 62.5, reps: 5 });
    expect(item(ts, 'i-bench-thu').loadKg).toBe(52.5);
  });

  it('todas "sobrado" proponen subir aunque no lleguen al máximo', () => {
    const it2 = { repMin: 5, repMax: 8, incrementKg: 2.5, loadKg: 60 };
    const e = { repMin: 5, sets: [1, 2, 3].map(() => ({ done: true, reps: 6, feel: 'easy' })) };
    expect(progressionFor(it2, e, null)).toMatchObject({ dir: 'up', reason: 'easy' });
  });

  it('una serie "justo" impide subir aunque llegue al máximo', () => {
    const it2 = { repMin: 5, repMax: 8, incrementKg: 2.5, loadKg: 60 };
    const e = { repMin: 5, sets: [{ done: true, reps: 8, feel: 'ok' }, { done: true, reps: 8, feel: 'hard' }] };
    expect(progressionFor(it2, e, null)).toBeNull();
  });

  it('al propagar una bajada no baja de la barra vacía', () => {
    const r = routine();
    r.templateSessions[1].items[0].loadKg = 21; // jueves casi en barra vacía
    const s = sessionFor(r, 'mon', (x) => entry(x, 'bench').sets.forEach((set) => { set.kg = 55; set.done = true; }));
    const changes = computeChanges(s, r, describe1);
    const ts = applyChanges(r, 'mon', changes, new Set(changes.map((c) => c.id)), {}, loadTypeOf);
    expect(item(ts, 'i-bench-thu').loadKg).toBe(20);
  });
});

describe('peso por mano', () => {
  it('mancuerna: media por mano; máquina: suma', () => {
    expect(kgFromSides(12, 14, 'dumbbell')).toBe(13);
    expect(kgFromSides(20, 25, 'total')).toBe(45);
    expect(splitOf(40, 'total')).toEqual({ kgL: 20, kgR: 20 });
    expect(splitOf(12, 'dumbbell')).toEqual({ kgL: 12, kgR: 12 });
  });

  it('guarda el reparto por mano, lo sube con la progresión y lo usa la próxima vez', () => {
    const r = routine();
    const s = sessionFor(r, 'mon', (x) => {
      const e = entry(x, 'curl');
      e.split = true;
      e.sets.forEach((set) => Object.assign(set, { kgL: 12, kgR: 14, kg: kgFromSides(12, 14, 'dumbbell'), done: true, feel: 'easy' }));
    });
    const { ts } = finish(r, s);
    const curl = item(ts, 'i-curl');
    expect(curl.sideLoads).toEqual([14, 16]); // +2 por mano
    expect(curl.loadKg).toBe(15);
    const next = buildSession({ ...r, templateSessions: ts }, ts.find((t) => t.id === 'mon'), exById, new Date(2026, 9, 19));
    expect(entry(next, 'curl').sets[0]).toMatchObject({ kgL: 14, kgR: 16 });
  });

  it('se recuerda en la rutina que el ejercicio va por mano', () => {
    const r = routine();
    const s = sessionFor(r, 'mon', (x) => { const e = entry(x, 'curl'); e.split = true; e.sets[0].done = true; });
    const { ts } = finish(r, s);
    expect(item(ts, 'i-curl').splitSides).toBe(true);
  });
});

describe('utilidades', () => {
  it('templateKey no depende del orden de las claves', () => {
    expect(templateKey([{ a: 1, b: [{ x: 1, y: 2 }] }])).toBe(templateKey([{ b: [{ y: 2, x: 1 }], a: 1 }]));
  });

  it('lastTimeFor devuelve la sesión finalizada más reciente con series hechas', () => {
    const sessions = [
      { id: 'a', date: '2026-10-01', status: 'done', entries: [{ exerciseId: 'bench', sets: [{ done: true, kg: 60, reps: 8 }] }] },
      { id: 'b', date: '2026-10-05', status: 'done', entries: [{ exerciseId: 'bench', sets: [{ done: true, kg: 62.5, reps: 6 }] }] },
      { id: 'c', date: '2026-10-07', status: 'skipped', entries: [] },
      { id: 'd', date: '2026-10-08', status: 'done', entries: [{ exerciseId: 'bench', sets: [{ done: false, kg: 70, reps: 5 }] }] },
    ];
    expect(lastTimeFor(sessions, 'bench', { id: 'x', date: '2026-10-09' }).date).toBe('2026-10-05');
  });
});
