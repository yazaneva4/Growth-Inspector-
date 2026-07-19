/** Animated sparkle that cycles ✳️ → ✴️ → ❇️, like the Claude Code terminal
 *  spinner. Pure CSS (keyframes in globals.css) — three stacked glyphs whose
 *  opacity is staggered so exactly one shows at a time. Presentational only,
 *  so it works in both server and client components. */
export function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`gi-sparkle ${className}`} aria-hidden>
      <span>✳️</span>
      <span>✴️</span>
      <span>❇️</span>
    </span>
  );
}
