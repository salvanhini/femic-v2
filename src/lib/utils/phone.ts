export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatBrazilianPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length > 6) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length > 0) return `(${digits}`;
  return "";
}
