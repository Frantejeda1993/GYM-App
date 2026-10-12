import { muscleLabel } from '../lib/muscles';

export default function MuscleChips({ primary = [], secondary = [] }) {
  return (
    <span className="muscles">
      {primary.map((m) => (
        <span key={m} className="chip chip-primary">{muscleLabel(m)}</span>
      ))}
      {secondary.map((m) => (
        <span key={m} className="chip">{muscleLabel(m)}</span>
      ))}
    </span>
  );
}
