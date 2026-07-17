/** Format a money amount so it never breaks the layout:
 *  - normal amounts: full value with 2 decimals (e.g. 6,900.00)
 *  - very large (≥ 1 trillion): compact notation (e.g. 1.42T)
 *  - absurd (≥ 1 quadrillion, i.e. junk/test data): scientific (e.g. 1.15e+63)
 *  Pair with a `title` showing the exact value for the rare large cases. */
export function formatMoney(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e15) return n.toExponential(2);
  if (abs >= 1e12) {
    return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  }
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The exact, fully-written amount — for tooltips/titles on formatted values. */
export function exactMoney(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
