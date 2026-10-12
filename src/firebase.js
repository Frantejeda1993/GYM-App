import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Configuración web de Firebase: es pública por diseño (viaja dentro de la app).
// La seguridad la imponen las reglas de Firestore (firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyBo1M3H5x4p16R_vEhMHCq-fz8oCvrj_2E',
  authDomain: 'gym-app-56c4b.firebaseapp.com',
  projectId: 'gym-app-56c4b',
  storageBucket: 'gym-app-56c4b.firebasestorage.app',
  messagingSenderId: '905259797631',
  appId: '1:905259797631:web:9d640dfeedae7a9046434a',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Caché persistente: la app funciona sin conexión y sincroniza al volver la señal.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
