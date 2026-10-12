import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import { userDoc } from './lib/db';

const AuthContext = createContext(null);

// status: loading | signedOut | denied | needsProfile | ready
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(readableAuthError(e)));
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setStatus('signedOut');
      } else {
        setStatus('loading');
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(
      userDoc(user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data());
          setStatus('ready');
        } else if (!snap.metadata.fromCache) {
          setProfile(null);
          setStatus('needsProfile');
        }
      },
      (e) => {
        if (e.code === 'permission-denied') setStatus('denied');
        else setError(e.message);
      },
    );
  }, [user]);

  async function signIn() {
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // Si el navegador bloquea la ventana emergente, se usa redirección.
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(readableAuthError(e));
      }
    }
  }

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, status, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function readableAuthError(e) {
  if (e?.code === 'auth/unauthorized-domain') {
    return 'Este dominio no está autorizado en Firebase (Authentication → Dominios autorizados).';
  }
  if (e?.code === 'auth/network-request-failed') return 'Sin conexión. Inténtalo con señal.';
  return e?.message || 'No se pudo iniciar sesión.';
}

export const useAuth = () => useContext(AuthContext);
