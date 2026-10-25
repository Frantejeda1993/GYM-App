import { useState } from 'react';
import { useAuth } from '../auth';
import { saveProfile } from '../lib/db';
import { Header, Stepper } from '../components/ui';

export default function Profile({ onboarding }) {
  const { user, profile, signOut } = useAuth();
  const [form, setForm] = useState({
    name: profile?.name || user?.displayName?.split(' ')[0] || '',
    bodySex: profile?.bodySex || '',
    defaultBarKg: profile?.defaultBarKg ?? 20,
    weighReminderDays: profile?.weighReminderDays ?? 14,
    heightCm: profile?.heightCm ?? '',
  });
  const [saved, setSaved] = useState(false);
  const set = (k) => (v) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const valid = form.name.trim() && form.bodySex;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    const data = {
      name: form.name.trim(),
      bodySex: form.bodySex,
      defaultBarKg: Number(form.defaultBarKg) || 0,
      weighReminderDays: Number(form.weighReminderDays) || 14,
      heightCm: Number(form.heightCm) || null,
      email: user.email,
    };
    if (onboarding) await saveProfile(user.uid, data, true);
    else {
      saveProfile(user.uid, data, false).catch(console.error);
      setSaved(true);
    }
  }

  return (
    <div className={onboarding ? 'page onboarding' : 'page'}>
      <Header title={onboarding ? 'Configura tu perfil' : 'Perfil'} />
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Nombre</span>
          <input value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </label>

        <div className="field">
          <span>Silueta del dashboard</span>
          <div className="segmented">
            {[['male', 'Hombre'], ['female', 'Mujer']].map(([v, l]) => (
              <button type="button" key={v} className={form.bodySex === v ? 'on' : ''} onClick={() => set('bodySex')(v)}>{l}</button>
            ))}
          </div>
        </div>

        <Stepper label="Altura (opcional)" value={form.heightCm} onChange={set('heightCm')} step={1} max={250} suffix="cm" allowEmpty />
        <Stepper label="Peso de barra por defecto" value={form.defaultBarKg} onChange={set('defaultBarKg')} step={2.5} suffix="kg" />
        <Stepper label="Avisar si no te pesas en" value={form.weighReminderDays} onChange={set('weighReminderDays')} step={1} min={1} suffix="días" />

        <button className="btn primary wide" disabled={!valid}>{onboarding ? 'Empezar' : 'Guardar'}</button>
        {saved && <p className="ok">Guardado.</p>}
      </form>

      <div className="section">
        <p className="muted small">Conectado como {user?.email}</p>
        <button className="btn ghost wide" onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  );
}
