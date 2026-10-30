// Firestore simulado en memoria + localStorage (solo para npm run dev:mock).
const KEY = 'mock-firestore';
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* */ }
const subs = new Set();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* */ } };
const notify = () => { persist(); subs.forEach((s) => s()); };
let n = 0;
const autoId = () => `m${Date.now().toString(36)}${(n++).toString(36)}`;

export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const serverTimestamp = () => new Date().toISOString();

export function collection(_db, ...parts) { return { type: 'col', path: parts.join('/') }; }
export function doc(dbOrCol, ...parts) {
  if (dbOrCol?.type === 'col') return { type: 'doc', path: `${dbOrCol.path}/${parts[0] || autoId()}`, get id() { return this.path.split('/').pop(); } };
  const path = parts.join('/');
  return { type: 'doc', path, id: path.split('/').pop() };
}
const parentOf = (path) => path.split('/').slice(0, -1).join('/');

export async function setDoc(ref, data, opts) {
  store[ref.path] = opts?.merge ? { ...(store[ref.path] || {}), ...data } : { ...data };
  notify();
}
// Resuelve valores especiales (arrayUnion) contra el documento actual.
function resolve(current, data) {
  const out = { ...data };
  Object.entries(out).forEach(([k, v]) => {
    if (v && v.__arrayUnion) out[k] = [...new Set([...(current?.[k] || []), ...v.__arrayUnion])];
  });
  return out;
}
export async function updateDoc(ref, data) {
  if (!store[ref.path]) throw new Error('not-found');
  store[ref.path] = { ...store[ref.path], ...resolve(store[ref.path], data) };
  notify();
}
export async function addDoc(col, data) { const ref = doc(col); await setDoc(ref, data); return ref; }
export function writeBatch() {
  const ops = [];
  return {
    update: (ref, data) => ops.push(() => { store[ref.path] = { ...store[ref.path], ...resolve(store[ref.path], data) }; }),
    set: (ref, data) => ops.push(() => { store[ref.path] = { ...data }; }),
    delete: (ref) => ops.push(() => { delete store[ref.path]; }),
    commit: async () => { ops.forEach((o) => o()); notify(); },
  };
}

export function onSnapshot(ref, cb) {
  const run = () => {
    if (ref.type === 'doc') {
      const data = store[ref.path];
      cb({ exists: () => !!data, data: () => data, id: ref.id, metadata: { fromCache: false } });
    } else {
      const docs = Object.keys(store)
        .filter((p) => parentOf(p) === ref.path)
        .map((p) => ({ id: p.split('/').pop(), data: () => store[p] }));
      cb({ docs });
    }
  };
  subs.add(run);
  setTimeout(run, 0);
  return () => subs.delete(run);
}
export async function deleteDoc(ref) { delete store[ref.path]; notify(); }
// arrayUnion simulado: se resuelve en updateDoc/batch.update.
export const arrayUnion = (...values) => ({ __arrayUnion: values });
