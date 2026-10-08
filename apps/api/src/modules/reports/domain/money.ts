const SCALE = 10_000n;

function toUnits(amount: string): bigint {
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = amount.replace(/^[-+]/, "").split(".");
  const units = BigInt(whole || "0") * SCALE + BigInt(fraction.padEnd(4, "0").slice(0, 4));
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const magnitude = units < 0n ? -units : units;
  return `${sign}${magnitude / SCALE}.${String(magnitude % SCALE).padStart(4, "0")}`;
}

function divideRounded(dividend: bigint, divisor: bigint): bigint {
  const negative = (dividend < 0n) !== (divisor < 0n);
  const a = dividend < 0n ? -dividend : dividend;
  const b = divisor < 0n ? -divisor : divisor;
  const rounded = (a * 2n + b) / (b * 2n);
  return negative ? -rounded : rounded;
}

export function costPerLead(spend: string, leads: number): string | null {
  if (leads === 0) return null;
  return fromUnits(divideRounded(toUnits(spend), BigInt(leads)));
}

export function relativeChange(current: string, previous: string): string | null {
  const before = toUnits(previous);
  if (before === 0n) return null;
  return fromUnits(divideRounded((toUnits(current) - before) * SCALE, before));
}
