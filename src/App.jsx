import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Denied from './pages/Denied';
import Profile from './pages/Profile';
import Today from './pages/Today';
import Catalog from './pages/Catalog';
import ExerciseForm from './pages/ExerciseForm';
import Routines from './pages/Routines';
import RoutineEditor from './pages/RoutineEditor';
import TabBar from './components/TabBar';

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') return <div className="splash">Cargando…</div>;
  if (status === 'signedOut') return <Login />;
  if (status === 'denied') return <Denied />;
  if (status === 'needsProfile') return <Profile onboarding />;

  return (
    <div className="app">
      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/rutinas" element={<Routines />} />
          <Route path="/rutinas/:id" element={<RoutineEditor />} />
          <Route path="/ejercicios" element={<Catalog />} />
          <Route path="/ejercicios/nuevo" element={<ExerciseForm />} />
          <Route path="/ejercicios/:id" element={<ExerciseForm />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}
