import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/utils/date";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface AppointmentCardProps {
  appointment: Appointment;
  patient: Patient | undefined;
  service: Service | undefined;
  style: React.CSSProperties;
  durationMinutes?: number;
  onClick: (e: React.MouseEvent) => void;
}

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-amber-100 text-amber-950 border-l-4 border-l-amber-500 dark:bg-amber-950/70 dark:text-amber-50",
  confirmado: "bg-sky-100 text-sky-950 border-l-4 border-l-sky-500 dark:bg-sky-950/70 dark:text-sky-50",
  concluido: "bg-emerald-100 text-emerald-950 border-l-4 border-l-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-50",
  cancelado: "bg-rose-100 text-rose-950 border-l-4 border-l-rose-500 dark:bg-rose-950/70 dark:text-rose-50",
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0] ?? name} ${(parts[parts.length - 1] ?? "")[0] ?? ""}.`;
}

export function AppointmentCard({
  appointment,
  patient,
  service,
  style,
  durationMinutes = 45,
  onClick,
}: AppointmentCardProps) {
  const showPatient = durationMinutes >= 30;
  const showService = durationMinutes >= 55;
  const patientName = patient?.name || "Paciente não identificado";

  return (
    <button
      type="button"
      className={cn(
        "group absolute cursor-pointer overflow-hidden rounded-lg border border-border px-1.5 py-1 text-left shadow-sm transition-all hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        STATUS_STYLES[appointment.status] || "bg-card border-l-4 border-l-muted-foreground"
      )}
      style={style}
      onClick={onClick}
      title={`${fmtTime(appointment.start_time)} · ${patientName}${service ? ` · ${service.name}` : ""}`}
      aria-label={`Agendamento de ${patientName} às ${fmtTime(appointment.start_time)}`}
    >
      <span className="block truncate text-[10px] font-bold text-current opacity-75">
        {fmtTime(appointment.start_time)}
      </span>

      {showPatient && (
        <p className="truncate text-[11px] font-bold leading-tight text-current">
          {patient?.name ? shortName(patient.name) : "?"}
        </p>
      )}

      {service && showService && (
        <p className="truncate text-[9px] leading-tight text-current opacity-75">
          {service.name}
        </p>
      )}
    </button>
  );
}
