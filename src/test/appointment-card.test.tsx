import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import type { Appointment, Patient, Service } from "@/lib/types/database";

const patient: Patient = {
  id: "patient-1",
  name: "Maria da Silva",
  pathology: null,
  whatsapp: null,
  birth_date: null,
  referral_source: null,
  feedback_sent: false,
  feedback_sent_at: null,
  archived: false,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const service: Service = {
  id: "service-1",
  name: "Fisioterapia",
  type: null,
  price: 100,
  duration_minutes: 60,
  appointment_mode: "individual",
  max_patients: 1,
  health_insurance_id: null,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function appointment(status: string): Appointment {
  return {
    id: `appointment-${status}`,
    patient_id: patient.id,
    service_id: service.id,
    appointment_date: "2026-07-15",
    start_time: "09:00",
    end_time: "10:00",
    duration_minutes: 60,
    status,
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

describe("AppointmentCard", () => {
  it.each([
    ["agendado", "border-l-amber-400"],
    ["confirmado", "border-l-blue-400"],
    ["concluido", "border-l-green-400"],
    ["cancelado", "border-l-red-400"],
  ])("uses the correct status accent for %s", (status, accentClass) => {
    render(
      <AppointmentCard
        appointment={appointment(status)}
        patient={patient}
        service={service}
        style={{}}
        durationMinutes={60}
        onClick={() => undefined}
      />
    );

    const card = screen.getByRole("button", { name: /agendamento de maria da silva/i });
    expect(card).toHaveClass(accentClass);
    expect(card).toHaveClass("dark:bg-slate-700/70", "dark:text-white");
  });
});
