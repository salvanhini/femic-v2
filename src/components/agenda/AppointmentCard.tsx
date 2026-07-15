import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/utils/date";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface AppointmentCardProps {
  appointment: Appointment;
  patient: Patient | undefined;
  service: Service | undefined;
  style: React.CSSProperties;
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
  return parts[0] + " " + parts[parts.length - 1][0] + ".";
}

export function AppointmentCard({
  appointment,
  patient,
  service,
  style,
  onClick,
}: AppointmentCardProps) {
  return (
    <div
      className={cn(
        "group absolute cursor-pointer overflow-hidden rounded-lg border border-slate-200/60 px-1.5 py-1 shadow-sm transition-all hover:z-10 hover:shadow-md",
        STATUS_STYLES[appointment.status] || "bg-white border-l-4 border-l-gray-300"
      )}
      style={style}
      onClick={onClick}
    >
      <span className="truncate text-[10px] font-bold text-slate-500">
        {fmtTime(appointment.start_time)}
      </span>

      <p className="truncate text-[11px] font-bold leading-tight">
        {patient?.name ? shortName(patient.name) : "?"}
      </p>

      {service && (
        <p className="hidden truncate text-[9px] text-slate-500 group-hover:block leading-tight">
          {service.name}
        </p>
      )}
    </div>
  );
}
