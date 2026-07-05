/**
 * Growth Inspector brand mark: an orange "G" (ring + inward arm) with a navy
 * tile in the gap holding a magnifier (inspector) and sparkle (brilliance).
 * Mark colors are fixed regardless of surface; `variant` only affects the
 * wordmark text color so it reads on dark vs light backgrounds.
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
      height={size * (215 / 185)}
      viewBox="60 32 185 215"
      className={`flex-shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="logoOrange" x1="70" y1="60" x2="260" y2="280" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FAA57A" />
          <stop offset="0.5" stopColor="#F26522" />
          <stop offset="1" stopColor="#DF4508" />
        </linearGradient>
        <linearGradient id="logoNavy" x1="148" y1="44" x2="232" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#33447F" />
          <stop offset="1" stopColor="#0E1A40" />
        </linearGradient>
      </defs>
      {/* Orange ring, open at the upper-right */}
      <path
        d="M 228 160 A 78 78 0 1 1 155 83"
        stroke="url(#logoOrange)"
        strokeWidth="50"
        fill="none"
        strokeLinecap="round"
      />
      {/* Solid inward arm — the G crossbar */}
      <rect x="155" y="135" width="82" height="50" rx="25" fill="url(#logoOrange)" />
      {/* Navy tile filling the gap */}
      <rect x="146" y="42" width="82" height="82" rx="18" fill="url(#logoNavy)" />
      {/* Magnifier (inspector) */}
      <circle cx="178" cy="76" r="13.5" fill="none" stroke="#ffffff" strokeWidth="5.5" />
      <line x1="187.5" y1="85.5" x2="198" y2="96" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" />
      {/* Sparkle (brilliance) */}
      <path
        d="M 204 54 C 205.4 59.6 206.8 61 212 62.4 C 206.8 63.8 205.4 65.2 204 70.8 C 202.6 65.2 201.2 63.8 196 62.4 C 201.2 61 202.6 59.6 204 54 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Full lockup: mark + stacked "Growth / Inspector" wordmark. */
export function Logo({
  variant = "dark",
  size = 36,
}: {
  variant?: "dark" | "light";
  size?: number;
}) {
  const growth = variant === "dark" ? "text-white" : "text-slate-950";
  const accent = variant === "dark" ? "text-emerald-400" : "text-slate-600";
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} className="drop-shadow-sm" />
      <div className="leading-tight">
        <div className={`text-base font-bold tracking-tight ${growth}`}>Growth</div>
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${accent}`}>
          Inspector
        </div>
      </div>
    </div>
  );
}
