import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import seed from './data/exercises.json';
import { exercisesCol, routinesCol, sessionsCol, weekOverrideDoc } from './lib/db';
import { normalize } from './lib/text';
import { useAuth } from './auth';

const DataContext = createContext(null);

// Catálogo semilla (empaquetado en la app, sin coste de lecturas) en el mismo
// formato que los ejercicios creados por usuarios en Firestore.
const SEED = seed.map((x) => ({
  id: x.id,
  name: x.n,
  primaryMuscles: x.p,
  secondaryMuscles: x.s,
  equipment: x.e,
  loadType: x.l,
  defaultBarKg: x.b ?? null,
  source: 'seed',
  archived: false,
  nameNormalized: normalize(x.n),
  images: Array.from({ length: x.i || 0 }, (_, f) => `${import.meta.env.BASE_URL}ex/${encodeURIComponent(x.id)}-${f}.webp`),
}));

// Los ejercicios de usuario guardan una foto pequeña (data URL) en imageData.
const withImages = (e) => ({ ...e, images: e.imageData ? [e.imageData] : [] });

export function DataProvider({ children }) {
  const { user, status } = useAuth();
  const [userExercises, setUserExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [weekOverride, setWeekOverride] = useState(null);
  const [loaded, setLoaded] = useState({ ex: false, rt: false, ss: false });

  useEffect(() => {
    if (!user || status !== 'ready') return undefined;
    const unEx = onSnapshot(exercisesCol(), (snap) => {
      setUserExercises(snap.docs.map((d) => withImages({ id: d.id, ...d.data() })));
      setLoaded((l) => ({ ...l, ex: true }));
    });
    const unRt = onSnapshot(routinesCol(user.uid), (snap) => {
      setRoutines(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => !r.deleted)
          .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (a.name || '').localeCompare(b.name || '')),
      );
      setLoaded((l) => ({ ...l, rt: true }));
    });
    const unSs = onSnapshot(sessionsCol(user.uid), (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date < b.date ? 1 : -1)));
      setLoaded((l) => ({ ...l, ss: true }));
    });
    const unWo = onSnapshot(weekOverrideDoc(user.uid), (snap) => setWeekOverride(snap.exists() ? snap.data() : null));
    return () => {
      unEx();
      unRt();
      unSs();
      unWo();
    };
  }, [user, status]);

  const value = useMemo(() => {
    const all = [...userExercises, ...SEED];
    const byId = new Map(all.map((e) => [e.id, e]));
    const catalog = all
      .filter((e) => !e.archived)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      catalog,
      exerciseById: (id) => byId.get(id),
      userExercises,
      routines,
      activeRoutine: routines.find((r) => r.active) || null,
      routineById: (id) => routines.find((r) => r.id === id) || null,
      sessions,
      weekOverride,
      loaded: loaded.ex && loaded.rt && loaded.ss,
    };
  }, [userExercises, routines, sessions, weekOverride, loaded]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
