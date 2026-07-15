import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/utils/date";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  onDateChange: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

export function DayView({
  date,
  appointments,
  patients,
  services,
  onDateChange,
  onAppointmentClick,
}: DayViewProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayAppointments = appointments.filter(
    (a) => a.appointment_date === dateStr
  );

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  function prevDay() {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  }

  function nextDay() {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  }

  const sortedAppts = [...dayAppointments].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const statusLabels: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={prevDay}
          >
            ←
          </button>
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={nextDay}
          >
            →
          </button>
          <h3 className="ml-2 text-lg font-bold">
            {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h3>
        </div>
      </div>

      <div className="space-y-2">
        {sortedAppts.map((appt) => {
          const patient = patientMap.get(appt.patient_id);
          const service = serviceMap.get(appt.service_id || "");

          return (
            <div
              key={appt.id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent",
                appt.status === "cancelado" && "opacity-60"
              )}
              onClick={() => onAppointmentClick(appt)}
            >
              <div className="min-w-[80px] text-center">
                <p className="text-lg font-black">{fmtTime(appt.start_time)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(appt.end_time)}
                </p>
              </div>

              <div className="flex-1">
                <p
                  className={cn(
                    "font-bold",
                    appt.status === "cancelado" && "line-through opacity-70"
                  )}
                >
                  {patient?.name || "Paciente"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {service?.name || "Serviço"}
                </p>
              </div>

              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  appt.status === "cancelado" &&
                    "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200",
                  appt.status === "concluido" &&
                    "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-200",
                  appt.status === "agendado" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
                  appt.status === "confirmado" &&
                    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
                )}
              >
                {statusLabels[appt.status] || appt.status}
              </span>
            </div>
          );
        })}

        {sortedAppts.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Nenhum agendamento neste dia.
          </div>
        )}
      </div>
    </div>
  );
}
