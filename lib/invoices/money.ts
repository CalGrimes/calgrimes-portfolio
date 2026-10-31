const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;
const QUANTITY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,3}))?$/;

function clean(input: string): string {
  return input.trim().replace(/[\s,£$€]/g, "");
}

export function toMinor(major: string | number): number {
  if (typeof major === "number") {
    if (!Number.isFinite(major)) {
      throw new Error(`Not a valid money amount: ${String(major)}`);
    }

    const minor = Math.round((Math.abs(major) + Number.EPSILON) * 100);
    return major < 0 ? -minor : minor;
  }

  const sanitized = clean(major);
  const match = MONEY_PATTERN.exec(sanitized);

  if (!match) {
    throw new Error(`Not a valid money amount: ${String(major)}`);
  }

  const normalized = Number(sanitized);
  const minor = Math.round((Math.abs(normalized) + Number.EPSILON) * 100);
  return normalized < 0 ? -minor : minor;
}

export function toMajor(minor: number): number {
  return minor / 100;
}

export function toMilli(quantity: string | number): number {
  const raw = typeof quantity === "number" ? quantity.toFixed(3) : quantity;
  const match = QUANTITY_PATTERN.exec(clean(raw));

  if (!match) {
    throw new Error(`Not a valid quantity: ${String(quantity)}`);
  }

  const [, sign, whole, frac = ""] = match;
  const milli = Number(whole) * 1000 + Number(frac.padEnd(3, "0"));
  return sign ? -milli : milli;
}

export function fromMilli(milli: number): number {
  return milli / 1000;
}

export function computeLineAmountMinor(
  quantityMilli: number,
  unitPriceMinor: number
): number {
  return Math.round((quantityMilli * unitPriceMinor) / 1000);
}

export function formatMoney(
  minor: number,
  currency = "GBP",
  locale = "en-GB"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(toMajor(minor));
}
