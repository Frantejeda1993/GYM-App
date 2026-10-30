import { describe, it, expect } from 'vitest';
import { proposeImprovements } from '../routineTips';
import seed from '../../data/exercises.json';

const byId = new Map(seed.map((x) => [x.id, { id: x.id, name: x.n, primaryMuscles: x.p, secondaryMuscles: x.s, loadType: x.l, defaultBarKg: x.b ?? null }]));
const exerciseById = (id) => byId.get(id);
const item = (id, exerciseId, extra = {}) => ({ id, kind: 'strength', exerciseId, sets: 3, repMin: 8, repMax: 12, reps: null, loadKg: 20, barKg: 0, loadMode: 'fixed', setLoads: null, incrementKg: 2.5, restSec: 90, ...extra });

const base = () => ({
  id: 'r', mode: 'weekly', templateSessions: [
    { id: 'a', name: 'Torso', weekday: 0, items: [
      item('1', 'Dumbbell_Bicep_Curl'),
      item('2', 'Barbell_Bench_Press_-_Medium_Grip', { repMin: 4, repMax: 6, restSec: 90 }),
      item('3', 'Barbell_Bench_Press_-_Medium_Grip'),
    ] },
    { id: 'b', name: 'Vacía', weekday: 2, items: [] },
  ],
});
const step = (steps, key) => steps.find((s) => s.key === key);

describe('proponer mejoras', () => {
  it('agrega por rutina y cada paso aplicable cambia la rutina', () => {
    const r = base();
    const steps = proposeImprovements(r, exerciseById);
    expect(step(steps, 'empty')).toBeTruthy();
    expect(step(steps, 'repeated')).toBeTruthy();
    expect(step(steps, 'short-rest-heavy')).toBeTruthy();
    expect(step(steps, 'order')).toBeTruthy();

    let x = step(steps, 'empty').apply(r);
    expect(x.templateSessions.map((s) => s.id)).toEqual(['a']);
    x = step(steps, 'repeated').apply(x);
    expect(x.templateSessions[0].items.filter((i) => i.exerciseId.startsWith('Barbell_Bench')).map((i) => i.sets)).toEqual([6]);
    x = step(steps, 'short-rest-heavy').apply(x);
    expect(x.templateSessions[0].items.find((i) => i.id === '2').restSec).toBe(150);
    x = step(steps, 'order').apply(x);
    expect(x.templateSessions[0].items[0].exerciseId).toBe('Barbell_Bench_Press_-_Medium_Grip');
    // No muta la rutina original
    expect(r.templateSessions.length).toBe(2);
  });

  it('los pasos ignorados no se vuelven a proponer', () => {
    const steps = proposeImprovements(base(), exerciseById, { ignored: ['empty', 'order'] });
    expect(step(steps, 'empty')).toBeUndefined();
    expect(step(steps, 'order')).toBeUndefined();
  });

  it('más empuje que tirón: añade un remo en la sesión con más empuje', () => {
    const r = { id: 'r', mode: 'weekly', templateSessions: [
      { id: 'a', name: 'Push', weekday: 0, items: [item('1', 'Barbell_Bench_Press_-_Medium_Grip', { sets: 5 }), item('2', 'Dumbbell_Shoulder_Press', { sets: 4 })] },
      { id: 'b', name: 'Legs', weekday: 2, items: [item('3', 'Barbell_Full_Squat')] },
    ] };
    const s = step(proposeImprovements(r, exerciseById), 'push-pull');
    expect(s).toBeTruthy();
    const x = s.apply(r);
    expect(x.templateSessions[0].items.at(-1).exerciseId).toBe('Seated_Cable_Rows');
  });
});
