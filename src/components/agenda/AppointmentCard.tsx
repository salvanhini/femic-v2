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
  agendado: "bg-amber-50 border-l-4 border-l-amber-400",
  confirmado: "bg-blue-50 border-l-4 border-l-blue-400",
  concluido: "bg-green-50 border-l-4 border-l-green-400 opacity-75",
  cancelado: "bg-red-50 border-l-4 border-l-red-400 opacity-60",
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
        "group absolute cursor-pointer overflow-hidden rounded-lg border border-slate-200/60 px-1.5 py-1 text-left shadow-sm transition-all hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        STATUS_STYLES[appointment.status] || "bg-white border-l-4 border-l-gray-300"
      )}
      style={style}
      onClick={onClick}
      title={`${fmtTime(appointment.start_time)} · ${patientName}${service ? ` · ${service.name}` : ""}`}
      aria-label={`Agendamento de ${patientName} às ${fmtTime(appointment.start_time)}`}
    >
      <span className="block truncate text-[10px] font-bold text-slate-500">
        {fmtTime(appointment.start_time)}
      </span>

      {showPatient && (
        <p className="truncate text-[11px] font-bold leading-tight">
          {patient?.name ? shortName(patient.name) : "?"}
        </p>
      )}

      {service && showService && (
        <p className="truncate text-[9px] leading-tight text-slate-500">
          {service.name}
        </p>
      )}
    </button>
  );
}
