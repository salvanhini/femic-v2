import { format, addDays, startOfMonth, endOfMonth, isSameMonth, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  onDateChange: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

export function MonthView({
  currentDate,
  appointments,
  patients,
  services,
  onDateChange,
  onAppointmentClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  }

  const appointmentsByDate = new Map<string, Appointment[]>();
  appointments.forEach((a) => {
    const existing = appointmentsByDate.get(a.appointment_date) || [];
    existing.push(a);
    appointmentsByDate.set(a.appointment_date, existing);
  });

  function prevMonth() {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  const statusCounts = (dateStr: string) => {
    const dayAppts = appointmentsByDate.get(dateStr) || [];
    return {
      agendado: dayAppts.filter((a) => a.status === "agendado" || a.status === "confirmado").length,
      concluido: dayAppts.filter((a) => a.status === "concluido").length,
      cancelado: dayAppts.filter((a) => a.status === "cancelado").length,
      total: dayAppts.length,
    };
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={prevMonth}
          >
            ←
          </button>
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={nextMonth}
          >
            →
          </button>
          <h3 className="ml-2 text-lg font-bold capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl border bg-border">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div
            key={day}
            className="bg-card px-2 py-2 text-center text-xs font-bold text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {calendarDays.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="bg-card p-2" />;
          }

          const dateStr = format(day, "yyyy-MM-dd");
          const counts = statusCounts(dateStr);
          const dayAppts = appointmentsByDate.get(dateStr) || [];

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[100px] bg-card p-1.5",
                isToday(day) && "bg-sky-50"
              )}
            >
              <p
                className={cn(
                  "mb-1 text-sm font-bold",
                  isToday(day) && "text-femic-cyan"
                )}
              >
                {format(day, "d")}
              </p>

              {counts.total > 0 && (
                <div className="mb-1 flex gap-1 text-[10px] text-muted-foreground">
                  <span className="text-amber-600">{counts.agendado} ag.</span>
                  <span className="text-green-600">{counts.concluido} conc.</span>
                  <span className="text-red-500">{counts.cancelado} can.</span>
                </div>
              )}

              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((appt) => (
                  <button
                    key={appt.id}
                    className={cn(
                      "w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium transition-colors hover:brightness-95",
                      appt.status === "cancelado" && "bg-red-100 text-red-600 line-through opacity-70",
                      appt.status === "concluido" && "bg-green-100 text-green-700",
                      (appt.status === "agendado" || appt.status === "confirmado") &&
                        "bg-amber-100 text-amber-800"
                    )}
                    onClick={() => onAppointmentClick(appt)}
                  >
                    {appt.start_time.slice(0, 5)} {patientMap.get(appt.patient_id)?.name}
                  </button>
                ))}
                {dayAppts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{dayAppts.length - 3} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
