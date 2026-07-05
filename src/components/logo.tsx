/**
 * Growth Inspector brand mark, traced from the brand reference:
 * a solid orange "G" drawn as one continuous flat-ended stroke (ring opening
 * at the top right, turning inward as the arm), with a navy glow tile floating
 * in the opening that carries a magnifier (inspector) and a tall four-point
 * sparkle (brilliance). Do not restyle — this geometry matches the brand file.
 */
export function LogoMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * (425 / 410)}
      viewBox="-5 -5 410 425"
      className={`flex-shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <radialGradient id="giTileGlow" cx="0.72" cy="0.22" r="1.1">
          <stop offset="0" stopColor="#44579E" />
          <stop offset="0.45" stopColor="#22326E" />
          <stop offset="1" stopColor="#14224F" />
        </radialGradient>
      </defs>
      {/* Orange G: flat (butt) ends, ring sweeping into the inward arm */}
      <path
        d="M 200 47.5 A 162.5 162.5 0 1 0 360 238.2 L 215 238.2"
        stroke="#F26522"
        strokeWidth="75"
        fill="none"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      {/* Navy glow tile in the G's opening */}
      <rect x="220" y="0" width="180" height="175" rx="30" fill="url(#giTileGlow)" />
      {/* Magnifier, lower-left of tile */}
      <circle cx="283" cy="88" r="36" fill="none" stroke="#ffffff" strokeWidth="13" />
      <line x1="307" y1="112" x2="330" y2="135" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
      {/* Tall four-point sparkle, upper-right of tile */}
      <path d="M 365 6 Q 371 30 392 42 Q 371 54 365 78 Q 359 54 338 42 Q 359 30 365 6 Z" fill="#ffffff" />
    </svg>
  );
}

/** Full lockup: mark + stacked "Growth / Inspector" wordmark. */
export function Logo({
  variant = "dark",
  size = 46,
}: {
  variant?: "dark" | "light";
  size?: number;
}) {
  const growth = variant === "dark" ? "text-white" : "text-slate-950";
  const accent = variant === "dark" ? "text-emerald-400" : "text-slate-600";
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`text-lg font-extrabold tracking-tight ${growth}`}>Growth</div>
        <div className={`text-xs font-bold uppercase tracking-wide ${accent}`}>
          Inspector
        </div>
      </div>
    </div>
  );
}
