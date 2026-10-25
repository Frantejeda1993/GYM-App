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
import Recommend from './pages/Recommend';
import Community from './pages/Community';
import TabBar from './components/TabBar';
import SessionPage from './pages/Session';
import Progress, { ProgressDetail } from './pages/Progress';
import BodyForm from './pages/Body';

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
          <Route path="/rutinas/recomendar" element={<Recommend />} />
          <Route path="/rutinas/comunidad" element={<Community />} />
          <Route path="/rutinas/:id" element={<RoutineEditor />} />
          <Route path="/ejercicios" element={<Catalog />} />
          <Route path="/ejercicios/nuevo" element={<ExerciseForm />} />
          <Route path="/ejercicios/:id" element={<ExerciseForm />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/sesion/:id" element={<SessionPage />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/progreso/:id" element={<ProgressDetail />} />
          <Route path="/cuerpo/:id" element={<BodyForm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}
