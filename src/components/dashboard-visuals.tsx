/** Dependency-free SVG charts for the polished dashboard. */

function points(series: number[], w: number, h: number, pad = 2) {
  if (series.length === 0) return { line: "", area: "" };
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  const step = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const xy = series.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${(pad + (series.length - 1) * step).toFixed(1)},${h - pad}`;
  return { line, area };
}

export function Sparkline({
  series,
  color = "#34d399",
  className = "",
}: {
  series: number[];
  color?: string;
  className?: string;
}) {
  const w = 220;
  const h = 48;
  const { line, area } = points(series.length ? series : [0, 0], w, h);
  const id = `g-${color.replace("#", "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`h-12 w-full ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LineChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const w = 560;
  const h = 200;
  const padX = 28;
  const padY = 24;
  const series = data.map((d) => d.value);
  const max = Math.max(...series, 1);
  const step =
    data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;
  const xy = data.map((d, i) => {
    const x = padX + i * step;
    const y = h - padY - (d.value / max) * (h - padY * 2);
    return [x, y, d] as const;
  });
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${padX},${h - padY} ${line} ${(padX + (data.length - 1) * step).toFixed(1)},${h - padY}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#vol)" />
      <polyline
        points={line}
        fill="none"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {xy.map(([x, y, d], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3.5" fill="#34d399" />
          <text
            x={x}
            y={y - 10}
            textAnchor="middle"
            className="fill-slate-300"
            fontSize="11"
          >
            {d.value}
          </text>
          <text
            x={x}
            y={h - 6}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize="10"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
