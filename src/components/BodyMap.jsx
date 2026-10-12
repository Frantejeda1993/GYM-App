import body from '../data/body.json';
import { regionLevel, REGION_MUSCLES } from '../lib/muscleLoad';

// Escala secuencial de un solo tono (verde lima), de oscuro a brillante, con saltos
// de luminosidad amplios para distinguir cada nivel sobre fondo oscuro.
export const LEVEL_COLORS = ['#30353c', '#3d4a1c', '#5f7a1e', '#93bf27', '#d4ff3a'];
const NON_MUSCLE = '#24282d';

// Silueta con los músculos coloreados por nivel. values: { músculo: series }.
export default function BodyMap({ sex = 'male', side = 'front', values, selected, onSelect, label }) {
  const key = `${sex === 'female' ? 'female' : 'male'}${side === 'back' ? 'Back' : 'Front'}`;
  const outline = body[`${sex === 'female' ? 'female' : 'male'}Outline`];
  const viewBox = side === 'back' ? outline.viewBack : outline.viewFront;
  return (
    <svg viewBox={viewBox} className="bodymap" role="img" aria-label={label}>
      <path d={side === 'back' ? outline.back : outline.front} fill={NON_MUSCLE} stroke="#3a4048" strokeWidth="3" />
      {body[key].map((part) => {
        const lvl = regionLevel(part.slug, values);
        const isMuscle = lvl != null;
        const active = selected && selected === part.slug;
        return (
          <g
            key={part.slug}
            onClick={isMuscle && onSelect ? () => onSelect(part.slug) : undefined}
            style={isMuscle ? { cursor: 'pointer' } : undefined}
          >
            {part.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={isMuscle ? LEVEL_COLORS[lvl] : NON_MUSCLE}
                stroke={active ? '#ffffff' : '#111316'}
                strokeWidth={active ? 5 : 2}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export { REGION_MUSCLES };
