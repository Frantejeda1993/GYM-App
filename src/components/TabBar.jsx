import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Hoy', icon: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z' },
  { to: '/rutinas', label: 'Rutinas', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { to: '/progreso', label: 'Progreso', icon: 'M4 19h16M6 16l4-5 3 3 5-7' },
  { to: '/ejercicios', label: 'Ejercicios', icon: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12' },
  { to: '/perfil', label: 'Perfil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
