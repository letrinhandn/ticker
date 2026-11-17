/** Marketpoly V4 currency — M$ (million). Show B$ when ≥ 1000 M$. */
export function money(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const b = abs / 1000;
    const s = Number.isInteger(b) ? String(b) : b.toFixed(2).replace(/\.?0+$/, "");
    return n < 0 ? `-${s} B$` : `${s} B$`;
  }
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${formatted} M$` : `${formatted} M$`;
}

/** Seat HUD: B$ always shows three decimal places (e.g. 1.250 B$). */
export function moneySeat(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const s = (abs / 1000).toFixed(3);
    return n < 0 ? `-${s} B$` : `${s} B$`;
  }
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${formatted} M$` : `${formatted} M$`;
}
