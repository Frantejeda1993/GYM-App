import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { normalize } from './text';
import { isoWeekKey, weekDates, toISODate, now, parseISODate, weekdayIndex } from './dates';
import { weekPlan, nextSequenceIndex } from './sessions';

export const userDoc = (uid) => doc(db, 'users', uid);
export const routinesCol = (uid) => collection(db, 'users', uid, 'routines');
export const exercisesCol = () => collection(db, 'exercises');
export const sessionsCol = (uid) => collection(db, 'users', uid, 'sessions');
export const bodyCol = (uid) => collection(db, 'users', uid, 'bodyMetrics');
export const exerciseNotesCol = (uid) => collection(db, 'users', uid, 'exerciseNotes');

// Apodo y notas personales de un ejercicio (solo visibles para el usuario).
export function saveExerciseNote(uid, exerciseId, { alias, notes }) {
  return fireAndForget(
    setDoc(doc(db, 'users', uid, 'exerciseNotes', exerciseId), {
      alias: (alias || '').trim(),
      notes: (notes || '').trim(),
      updatedAt: serverTimestamp(),
    }),
  );
}
export const weekOverrideDoc = (uid, key = isoWeekKey()) => doc(db, 'users', uid, 'weekOverrides', key);

// Las escrituras no se esperan: con la caché offline se aplican al instante
// en local y se sincronizan cuando hay conexión.
const fireAndForget = (p) => p.catch((e) => console.error('Error al sincronizar', e));

export function saveProfile(uid, data, isNew) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (isNew) payload.createdAt = serverTimestamp();
  return setDoc(userDoc(uid), payload, { merge: true });
}

export function createExercise(user, data) {
  const ref = doc(exercisesCol());
  fireAndForget(
    setDoc(ref, {
      ...data,
      nameNormalized: normalize(data.name),
      source: 'user',
      archived: false,
      createdBy: user.uid,
      createdByName: user.displayName || '',
      createdAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export function updateExercise(id, data) {
  const patch = { ...data, updatedAt: serverTimestamp() };
  if (data.name) patch.nameNormalized = normalize(data.name);
  return fireAndForget(updateDoc(doc(db, 'exercises', id), patch));
}

export function saveRoutine(uid, routine) {
  // createdAt/updatedAt los gestiona el servidor; no se reenvían desde el borrador.
  const { id, createdAt, updatedAt, activatedAt, ...data } = routine; // eslint-disable-line no-unused-vars
  const payload = { ...data, updatedAt: serverTimestamp() };
  // Solo se escribe activatedAt cuando es nuevo (Date); el de Firestore no se reenvía clonado.
  if (activatedAt instanceof Date) payload.activatedAt = activatedAt;
  if (id) {
    fireAndForget(setDoc(doc(db, 'users', uid, 'routines', id), payload, { merge: true }));
    return id;
  }
  const ref = doc(routinesCol(uid));
  fireAndForget(setDoc(ref, { ...payload, createdAt: serverTimestamp() }));
  return ref.id;
}

export function deleteRoutineSoft(uid, id) {
  return fireAndForget(
    updateDoc(doc(db, 'users', uid, 'routines', id), { deleted: true, active: false }),
  );
}

// Una sola rutina activa: activa la elegida y desactiva el resto.
export function setActiveRoutine(uid, routines, activeId) {
  const batch = writeBatch(db);
  routines.forEach((r) => {
    const shouldBe = r.id === activeId;
    if (!!r.active !== shouldBe) {
      const patch = { active: shouldBe };
      if (shouldBe) patch.activatedAt = serverTimestamp();
      batch.update(doc(db, 'users', uid, 'routines', r.id), patch);
    }
  });
  return fireAndForget(batch.commit());
}

// ---------- Sesiones ----------

export function startSession(uid, data) {
  const ref = doc(sessionsCol(uid));
  fireAndForget(setDoc(ref, { ...data, isoWeek: isoWeekKey(parseISODate(data.date)), startedAt: serverTimestamp() }));
  return ref.id;
}

export function saveSessionProgress(uid, id, { entries, cardio }) {
  return fireAndForget(updateDoc(doc(db, 'users', uid, 'sessions', id), { entries, cardio, updatedAt: serverTimestamp() }));
}

// Finaliza: la sesión queda inmutable, la plantilla se actualiza a futuro
// y, en modo secuencial, avanza la secuencia.
export function finalizeSession(uid, session, routine, templateSessions) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid, 'sessions', session.id), {
    entries: session.entries,
    cardio: session.cardio,
    status: 'done',
    finishedAt: serverTimestamp(),
  });
  if (routine) {
    const patch = {};
    if (templateSessions) patch.templateSessions = templateSessions;
    if (routine.mode === 'sequential') patch.nextSequenceIndex = nextSequenceIndex(routine, session.templateSessionId);
    if (Object.keys(patch).length) {
      batch.update(doc(db, 'users', uid, 'routines', routine.id), { ...patch, updatedAt: serverTimestamp() });
    }
  }
  return fireAndForget(batch.commit());
}

// Descartar: la sesión cuenta como no realizada (no avanza la secuencia).
export function discardSession(uid, id) {
  return fireAndForget(updateDoc(doc(db, 'users', uid, 'sessions', id), { status: 'skipped', finishedAt: serverTimestamp() }));
}

function skippedDoc(batch, uid, routine, templateSessionId, date) {
  const ts = routine.templateSessions.find((s) => s.id === templateSessionId);
  batch.set(doc(sessionsCol(uid)), {
    date,
    isoWeek: isoWeekKey(parseISODate(date)),
    routineId: routine.id,
    templateSessionId,
    sessionName: ts?.name || '',
    status: 'skipped',
    entries: [],
    cardio: [],
    finishedAt: serverTimestamp(),
  });
}

// "Eliminar ese día": los días perdidos quedan como no realizados.
export function skipMissedDays(uid, routine, missed) {
  const batch = writeBatch(db);
  missed.forEach((m) => skippedDoc(batch, uid, routine, m.templateSessionId, m.date));
  return fireAndForget(batch.commit());
}

// Reorganizar la semana. assignments: { fecha restante: templateSessionId | null }.
// Las sesiones que no caben se registran como no realizadas.
// permanent: además mueve los días de la plantilla (todas las sesiones deben caber).
export function applyReorganization(uid, routine, override, missed, assignments, leftover, permanent) {
  const batch = writeBatch(db);
  const plan = weekPlan(routine, override);
  const missedDates = new Set(missed.map((m) => m.date));
  const full = {};
  plan.forEach((p) => {
    if (p.date in assignments) full[p.date] = assignments[p.date];
    else full[p.date] = missedDates.has(p.date) ? null : p.templateSessionId;
  });
  batch.set(weekOverrideDoc(uid), { assignments: full, createdAt: serverTimestamp() });
  leftover.forEach((id) => skippedDoc(batch, uid, routine, id, toISODate(now())));
  if (permanent) {
    const moved = new Map(); // templateSessionId → nuevo día de la semana
    Object.entries(assignments).forEach(([date, id]) => id && moved.set(id, weekdayIndex(parseISODate(date))));
    const templateSessions = routine.templateSessions.map((s) => (moved.has(s.id) ? { ...s, weekday: moved.get(s.id) } : s));
    const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !templateSessions.some((s) => s.weekday === d));
    batch.update(doc(db, 'users', uid, 'routines', routine.id), { templateSessions, restDays, updatedAt: serverTimestamp() });
  }
  return fireAndForget(batch.commit());
}

// ---------- Composición corporal ----------

export function saveBodyMetric(uid, id, data) {
  const ref = id ? doc(db, 'users', uid, 'bodyMetrics', id) : doc(bodyCol(uid));
  fireAndForget(setDoc(ref, { ...data, updatedAt: serverTimestamp() }));
  return ref.id;
}

export function deleteBodyMetric(uid, id) {
  return fireAndForget(deleteDoc(doc(db, 'users', uid, 'bodyMetrics', id)));
}

export { addDoc, weekDates };
