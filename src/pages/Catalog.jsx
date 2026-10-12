import { useNavigate } from 'react-router-dom';
import { Header } from '../components/ui';
import ExerciseList from '../components/ExerciseList';

export default function Catalog() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <Header
        title="Ejercicios"
        action={
          <button className="icon-btn accent" onClick={() => navigate('/ejercicios/nuevo')} aria-label="Crear ejercicio">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        }
      />
      <ExerciseList onSelect={(e) => navigate(`/ejercicios/${encodeURIComponent(e.id)}`)} />
    </div>
  );
}
