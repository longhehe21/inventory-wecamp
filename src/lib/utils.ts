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
