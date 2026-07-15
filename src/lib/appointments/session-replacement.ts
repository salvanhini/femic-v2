import type { Appointment, SessionPackage } from "@/lib/types/database";

export interface ReplacementSuggestion {
  id: string;
  patient_id: string;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  service_price_at_time: number | null;
  conflicting_appointment_ids: string[];
}

export interface SessionReplacementAlert {
  package: SessionPackage;
  future_count: number;
  missing_count: number;
  suggestions: ReplacementSuggestion[];
}

type PatternSlot = Pick<Appointment, "service_id" | "start_time" | "end_time" | "duration_minutes" | "service_price_at_time"> & {
  weekday: number;
  count: number;
  last_date: string;
};

function isPackageAppointment(appointment: Appointment, pkg: SessionPackage) {
  return appointment.patient_id === pkg.patient_id && (!pkg.service_id || appointment.service_id === pkg.service_id);
}

function isFutureActive(appointment: Appointment, today: string) {
  return appointment.appointment_date >= today && ["agendado", "confirmado"].includes(appointment.status);
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}

function inferPattern(appointments: Appointment[], pkg: SessionPackage): PatternSlot[] {
  const recent = appointments
    .filter((appointment) => isPackageAppointment(appointment, pkg) && appointment.status !== "cancelado")
    .sort((a, b) => `${b.appointment_date}${b.start_time}`.localeCompare(`${a.appointment_date}${a.start_time}`))
    .slice(0, 6);

  const grouped = new Map<string, PatternSlot>();
  for (const appointment of recent) {
    const day = weekday(appointment.appointment_date);
    const key = `${day}|${appointment.start_time}|${appointment.end_time}|${appointment.service_id || ""}`;
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      if (appointment.appointment_date > current.last_date) current.last_date = appointment.appointment_date;
    } else {
      grouped.set(key, {
        weekday: day,
        service_id: pkg.service_id || appointment.service_id,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        duration_minutes: appointment.duration_minutes,
        service_price_at_time: appointment.service_price_at_time,
        count: 1,
        last_date: appointment.appointment_date,
      });
    }
  }

  const slots = [...grouped.values()].sort((a, b) => b.count - a.count || b.last_date.localeCompare(a.last_date));
  const repeated = slots.filter((slot) => slot.count >= 2);
  return (repeated.length ? repeated : slots.slice(0, 1)).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

export function buildSessionReplacementAlert(
  pkg: SessionPackage,
  appointments: Appointment[],
  today: string
): SessionReplacementAlert | null {
  if (!pkg.active || (pkg.remaining_sessions ?? 0) <= 0) return null;

  const future = appointments.filter((appointment) => isPackageAppointment(appointment, pkg) && isFutureActive(appointment, today));
  const missing = (pkg.remaining_sessions ?? 0) - future.length;
  if (future.length > 1 || missing <= 0) return null;

  const pattern = inferPattern(appointments, pkg);
  if (!pattern.length) return { package: pkg, future_count: future.length, missing_count: missing, suggestions: [] };

  const patientAppointments = appointments.filter((appointment) => appointment.patient_id === pkg.patient_id && appointment.status !== "cancelado");
  const patientDates = patientAppointments
    .map((appointment) => appointment.appointment_date)
    .sort();
  const lastDate = patientDates[patientDates.length - 1] || today;
  let cursor = addDays(new Date(`${lastDate}T12:00:00`), 1);
  const suggestions: ReplacementSuggestion[] = [];

  while (suggestions.length < missing) {
    const date = isoDate(cursor);
    for (const slot of pattern) {
      if (slot.weekday !== cursor.getDay() || suggestions.length >= missing) continue;
      const conflicts = appointments
        .filter((appointment) => appointment.appointment_date === date && appointment.status !== "cancelado")
        .filter((appointment) => timesOverlap(slot.start_time, slot.end_time, appointment.start_time, appointment.end_time))
        .map((appointment) => appointment.id);

      suggestions.push({
        id: `${date}-${slot.start_time}-${suggestions.length}`,
        patient_id: pkg.patient_id,
        service_id: slot.service_id,
        appointment_date: date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_minutes: slot.duration_minutes,
        service_price_at_time: slot.service_price_at_time,
        conflicting_appointment_ids: conflicts,
      });
    }
    cursor = addDays(cursor, 1);
  }

  return { package: pkg, future_count: future.length, missing_count: missing, suggestions };
}
