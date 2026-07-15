import { describe, expect, it } from "vitest";
import { buildSessionReplacementAlert } from "@/lib/appointments/session-replacement";
import type { Appointment, SessionPackage } from "@/lib/types/database";

const pkg: SessionPackage = {
  id: "pkg-1",
  patient_id: "patient-1",
  service_id: "service-1",
  total_sessions: 10,
  remaining_sessions: 3,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function appointment(id: string, date: string, patientId = "patient-1"): Appointment {
  return {
    id,
    patient_id: patientId,
    service_id: "service-1",
    appointment_date: date,
    start_time: "16:00",
    end_time: "16:45",
    duration_minutes: 45,
    status: "agendado",
    package_consumed: false,
    session_package_id: null,
    service_price_at_time: 100,
    notes: null,
    appointment_reminder_sent: false,
    appointment_reminder_sent_at: null,
    form_reminder_sent: false,
    form_reminder_sent_at: null,
    reminder_sent: false,
    reminder_sent_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("reposição de sessões", () => {
  it("sugere somente o saldo que ainda não está agendado", () => {
    const alert = buildSessionReplacementAlert(pkg, [
      appointment("past-1", "2026-06-01"),
      appointment("past-2", "2026-06-08"),
      appointment("future-1", "2026-07-20"),
    ], "2026-07-15");

    expect(alert?.future_count).toBe(1);
    expect(alert?.missing_count).toBe(2);
    expect(alert?.suggestions.map((suggestion) => suggestion.appointment_date)).toEqual(["2026-07-27", "2026-08-03"]);
  });

  it("não alerta quando o saldo já está coberto pela última sessão futura", () => {
    const coveredPackage = { ...pkg, remaining_sessions: 1 };
    const alert = buildSessionReplacementAlert(coveredPackage, [appointment("future-1", "2026-07-20")], "2026-07-15");

    expect(alert).toBeNull();
  });

  it("marca conflito na prévia sem remover a sugestão", () => {
    const alert = buildSessionReplacementAlert(pkg, [
      appointment("past-1", "2026-06-01"),
      appointment("past-2", "2026-06-08"),
      appointment("future-1", "2026-07-20"),
      appointment("other-patient", "2026-07-27", "patient-2"),
    ], "2026-07-15");

    expect(alert?.suggestions[0]?.conflicting_appointment_ids).toEqual(["other-patient"]);
  });
});
