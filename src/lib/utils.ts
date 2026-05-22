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
