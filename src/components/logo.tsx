/**
 * Growth Inspector brand mark: a solid orange "G" (ring + inward arm) with a
 * navy tile floating above it holding a magnifier (inspector) and sparkle
 * (brilliance). Flat colors — no gradients — for a clean, professional mark
 * that reproduces crisply at any size. `variant` only affects the wordmark
 * text color so it reads on dark vs light backgrounds.
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
      height={size * (235 / 185)}
      viewBox="60 15 185 235"
      className={`flex-shrink-0 ${className}`}
      aria-hidden
    >
      {/* Orange G: ring open at the upper-right + solid inward arm */}
      <path
        d="M 228 160 A 78 78 0 1 1 155 83"
        stroke="#F26522"
        strokeWidth="50"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="155" y="135" width="82" height="50" rx="25" fill="#F26522" />
      {/* Navy tile floats above the arm with a visible gap */}
      <rect x="150" y="24" width="72" height="72" rx="16" fill="#16255C" />
      <circle cx="177" cy="52" r="11.5" fill="none" stroke="#ffffff" strokeWidth="5" />
      <line x1="185" y1="60" x2="194" y2="69" stroke="#ffffff" strokeWidth="5.8" strokeLinecap="round" />
      <path
        d="M 199 34 C 200.2 38.8 201.4 40 205.8 41.2 C 201.4 42.4 200.2 43.6 199 48.4 C 197.8 43.6 196.6 42.4 192.2 41.2 C 196.6 40 197.8 38.8 199 34 Z"
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
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`text-base font-extrabold tracking-tight ${growth}`}>Growth</div>
        <div className={`text-[11px] font-bold uppercase tracking-wide ${accent}`}>
          Inspector
        </div>
      </div>
    </div>
  );
}
