/**
 * Growth Inspector brand mark — the "G": an orange ring with an inward arm
 * (the G's crossbar) and a rounded square filling the top-right gap.
 * `variant` flips the tile/square colors for dark vs light surfaces.
 */
export function LogoMark({
  size = 36,
  variant = "dark",
  className = "",
}: {
  size?: number;
  variant?: "dark" | "light";
  className?: string;
}) {
  const tile = variant === "dark" ? "#1B2A6B" : "#ffffff";
  const square = variant === "dark" ? "#ffffff" : "#1B2A6B";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`flex-shrink-0 ${className}`}
      aria-hidden
    >
      <rect
        width="64"
        height="64"
        rx="14"
        fill={tile}
        stroke={variant === "light" ? "#1B2A6B" : "none"}
        strokeWidth={variant === "light" ? 0.5 : 0}
      />
      {/* Orange ring, gap at top-right */}
      <path
        d="M 50 32 A 18 18 0 1 1 32 14"
        stroke="#F26522"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Inward arm — the G crossbar */}
      <rect x="34" y="28.5" width="16" height="7" rx="3.5" fill="#F26522" />
      {/* Rounded square in the gap */}
      <rect x="33" y="11" width="15" height="15" rx="3" fill={square} opacity="0.97" />
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
      <LogoMark size={size} variant={variant} className="drop-shadow-sm" />
      <div className="leading-tight">
        <div className={`text-base font-bold tracking-tight ${growth}`}>Growth</div>
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${accent}`}>
          Inspector
        </div>
      </div>
    </div>
  );
}
