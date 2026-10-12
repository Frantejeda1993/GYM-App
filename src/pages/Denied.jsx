import { useAuth } from '../auth';

export default function Denied() {
  const { user, signOut } = useAuth();
  return (
    <div className="center-screen">
      <h1 className="title-lg">Sin acceso</h1>
      <p className="muted">
        La cuenta <strong>{user?.email}</strong> no está invitada. Pide al administrador que la añada a la lista.
      </p>
      <button className="btn wide" onClick={signOut}>Usar otra cuenta</button>
    </div>
  );
}
