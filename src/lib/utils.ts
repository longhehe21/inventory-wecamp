import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString("vi-VN", { maximumFractionDigits: decimals });
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN");
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ";
}

// Helpers for currency inputs: store digit-only string in state, display
// with vi-VN thousand separators ("5127000" → "5.127.000").
export function formatIntegerInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

export function parseIntegerInput(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

// For inventory numbers that may have decimals.
// Convention: dot = thousand separator (vi-VN, removed on parse),
// comma = decimal separator (converted to dot internally).
// State stores English numeric like "1500.5"; display shows "1.500,5".
export function parseDecimalInput(s: string): string {
  // Keep only digits and one comma; strip dots (treated as thousand sep)
  const cleaned = s.replace(/[^\d,]/g, "").replace(/,/g, (m, i, str) => (str.indexOf(",") === i ? "." : ""));
  return cleaned;
}

export function formatDecimalInput(raw: string): string {
  if (!raw) return "";
  const [intStr, ...rest] = raw.split(".");
  const intNum = parseInt(intStr || "0", 10);
  const intFormatted = isNaN(intNum) ? "" : intNum.toLocaleString("vi-VN");
  if (raw.includes(".")) {
    return intFormatted + "," + rest.join("");
  }
  return intFormatted;
}
