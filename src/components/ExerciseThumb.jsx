// Miniatura de un ejercicio; si no tiene imagen, muestra sus iniciales.
export default function ExerciseThumb({ exercise, size = 56 }) {
  const src = exercise?.images?.[0];
  const style = { width: size, height: size };
  if (!src) {
    const initials = (exercise?.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className="thumb thumb-empty" style={style}>{initials}</span>;
  }
  return <img className="thumb" src={src} alt="" loading="lazy" decoding="async" style={style} />;
}
