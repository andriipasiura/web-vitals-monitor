const WIDTH = 72;
const HEIGHT = 20;

export function Sparkline({ values }: { values: (number | null)[] }) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) {
    return <span aria-hidden className="inline-block w-18" />;
  }
  const min = Math.min(...present);
  const span = Math.max(...present) - min || 1;
  const step = WIDTH / Math.max(values.length - 1, 1);
  const segments: string[] = [];
  let current = '';
  values.forEach((value, i) => {
    if (value === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    const x = (i * step).toFixed(1);
    const y = (HEIGHT - 2 - ((value - min) / span) * (HEIGHT - 4)).toFixed(1);
    current += `${current ? 'L' : 'M'}${x} ${y}`;
  });
  if (current) segments.push(current);

  return (
    <svg
      aria-hidden
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="shrink-0 overflow-visible"
    >
      <path
        d={segments.join('')}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="stroke-accent"
      />
    </svg>
  );
}
