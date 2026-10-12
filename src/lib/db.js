import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { normalize } from './text';

export const userDoc = (uid) => doc(db, 'users', uid);
export const routinesCol = (uid) => collection(db, 'users', uid, 'routines');
export const exercisesCol = () => collection(db, 'exercises');

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
  const { id, createdAt, updatedAt, ...data } = routine; // eslint-disable-line no-unused-vars
  const payload = { ...data, updatedAt: serverTimestamp() };
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
      batch.update(doc(db, 'users', uid, 'routines', r.id), { active: shouldBe });
    }
  });
  return fireAndForget(batch.commit());
}

export { addDoc };
