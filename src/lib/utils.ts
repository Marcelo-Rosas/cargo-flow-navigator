import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  options?: Omit<Intl.NumberFormatOptions, "style" | "currency"> & { locale?: string }
) {
  const { locale = "pt-BR", ...intlOptions } = options || {};
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    ...intlOptions,
  }).format(value);
}
