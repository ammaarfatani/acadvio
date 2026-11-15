export type NumberFormat = { prefix: string; startAt: number; padding: number };

export function normalizeNumberFormat(input: Partial<NumberFormat>, defaults: NumberFormat): NumberFormat {
  return {
    prefix: typeof input.prefix === "string" ? input.prefix : defaults.prefix,
    startAt: Math.max(1, Math.floor(Number(input.startAt) || defaults.startAt)),
    padding: Math.min(12, Math.max(0, Math.floor(Number(input.padding) || 0))),
  };
}

export function parseNumberedIdentifier(value: string, prefix: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp("^" + escaped + "([0-9]+)$").exec(value);
  return match ? Number(match[1]) : null;
}

export function formatNumberedIdentifier(value: number, format: NumberFormat): string {
  return format.prefix + String(value).padStart(format.padding, "0");
}
