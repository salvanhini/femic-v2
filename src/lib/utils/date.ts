import { format, parseISO, startOfWeek, endOfWeek, addDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

export function fmtDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export function fmtTime(time: string): string {
  return time.slice(0, 5);
}

export function fmtWeekday(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE", { locale: ptBR });
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function weekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function timeToMin(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = parseISO(isoDate);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

export function addMinutes(time: string, minutes: number): string {
  return minToTime(timeToMin(time) + minutes);
}

export function relativeTime(date: string): string {
  return formatDistanceToNow(parseISO(date), {
    addSuffix: true,
    locale: ptBR,
  });
}
