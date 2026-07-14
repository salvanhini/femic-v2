import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/utils/date";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface AppointmentCardProps {
  appointment: Appointment;
  patient: Patient | undefined;
  service: Service | undefined;
  style: React.CSSProperties;
  onClick: () => void;
  onStatusChange: (status: string) => void;
}

const statusStyles: Record<string, string> = {
  agendado: "bg-[#fff8e6]",
  confirmado: "bg-[#fff8e6]",
  concluido: "bg-[#ecfdf5]",
  cancelado: "bg-[#fef2f2] opacity-75",
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function AppointmentCard({
  appointment,
  patient,
  service,
  style,
  onClick,
  onStatusChange,
}: AppointmentCardProps) {
  const isCanceled = appointment.status === "cancelado";
  const isConcluded = appointment.status === "concluido";

  return (
    <div
      className={cn(
        "group absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-lg border border-slate-200/60 px-2 py-1.5 shadow-sm transition-all hover:z-10 hover:shadow-md",
        statusStyles[appointment.status] || "bg-white"
      )}
      style={style}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-bold text-slate-600">
          {fmtTime(appointment.start_time)}–{fmtTime(appointment.end_time)}
        </span>
        {!isCanceled && !isConcluded && (
          <select
            className="hidden text-[10px] group-hover:block"
            value=""
            onChange={(e) => {
              e.stopPropagation();
              if (e.target.value) onStatusChange(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="" disabled>
              Status
            </option>
            {appointment.status !== "confirmado" && (
              <option value="confirmado">Confirmar</option>
            )}
            {appointment.status !== "concluido" && (
              <option value="concluido">Concluir</option>
            )}
            {appointment.status !== "cancelado" && (
              <option value="cancelado">Cancelar</option>
            )}
          </select>
        )}
      </div>

      <p
        className={cn(
          "truncate text-sm font-bold",
          isCanceled && "line-through opacity-70"
        )}
      >
        {patient?.name || "Paciente"}
      </p>

      {service && (
        <p className="hidden truncate text-[11px] text-slate-500 group-hover:block">
          {service.name}
        </p>
      )}

      {isCanceled && (
        <span className="text-[10px] font-medium text-red-500">
          Cancelado
        </span>
      )}
      {isConcluded && (
        <span className="text-[10px] font-medium text-green-600">
          Concluído
        </span>
      )}
    </div>
  );
}
