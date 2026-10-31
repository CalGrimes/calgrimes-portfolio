/** Sequential per calendar year: INV-2026-0001, INV-2026-0002, ... */
export function nextInvoiceNumber(existing: string[], year: number): string {
  const prefix = `INV-${year}-`;

  const highest = existing
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number.parseInt(number.slice(prefix.length), 10))
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((max, sequence) => Math.max(max, sequence), 0);

  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
