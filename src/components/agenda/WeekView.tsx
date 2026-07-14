import { useMemo, useState } from "react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  parseISO,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import { fmtTime, timeToMin, minToTime } from "@/lib/utils/date";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentModal } from "./AppointmentModal";
import { useQuickStatus } from "@/hooks/use-appointments";
import type { Appointment, Patient, Service } from "@/lib/types/database";

interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  onDateChange: (date: Date) => void;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export function WeekView({
  currentDate,
  appointments,
  patients,
  services,
  onDateChange,
}: WeekViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const quickStatus = useQuickStatus();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from(
    { length: TOTAL_HOURS },
    (_, i) => `${String(START_HOUR + i).padStart(2, "0")}:00`
  );

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      map.set(
        key,
        appointments.filter((a) => a.appointment_date === key)
      );
    }
    return map;
  }, [appointments, days]);

  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, Service>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  function getCardStyle(appointment: Appointment) {
    const startMin = timeToMin(appointment.start_time);
    const endMin = timeToMin(appointment.end_time);
    const startOffset = startMin - START_HOUR * 60;
    const duration = Math.max(endMin - startMin, 15);
    const top = (startOffset / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${height}px` };
  }

  function handleSlotClick(day: Date, hour: number) {
    const dateStr = format(day, "yyyy-MM-dd");
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    setEditingAppointment(null);
    setSelectedDate(dateStr);
    setSelectedSlot(timeStr);
    setModalOpen(true);
  }

  function handleCardClick(appointment: Appointment) {
    setEditingAppointment(appointment);
    setSelectedDate(appointment.appointment_date);
    setSelectedSlot(appointment.start_time);
    setModalOpen(true);
  }

  function handleStatusChange(id: string, status: string) {
    quickStatus.mutate({ id, status });
  }

  function prevWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    onDateChange(d);
  }

  function nextWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    onDateChange(d);
  }

  function goToday() {
    onDateChange(new Date());
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            onClick={goToday}
          >
            Hoje
          </button>
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={prevWeek}
          >
            ←
          </button>
          <button
            className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent"
            onClick={nextWeek}
          >
            →
          </button>
          <h3 className="ml-2 text-base font-bold">
            {format(weekStart, "dd MMM", { locale: ptBR })} —{" "}
            {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}
          </h3>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-card">
        <div
          className="relative grid min-w-[900px]"
          style={{
            gridTemplateColumns: `60px repeat(7, 1fr)`,
            height: `${TOTAL_HOURS * HOUR_HEIGHT + 48}px`,
          }}
        >
          {/* Header */}
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "sticky top-0 z-10 border-b border-r bg-card px-2 py-2 text-center",
                i === 0 && "col-start-2"
              )}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <p
                className={cn(
                  "text-lg font-bold",
                  isToday(day) && "text-femic-cyan"
                )}
              >
                {format(day, "d")}
              </p>
            </div>
          ))}

          {/* Time labels */}
          {hours.map((hour, i) => (
            <div
              key={hour}
              className="border-r text-right text-[11px] text-muted-foreground"
              style={{
                gridRow: i + 2,
                gridColumn: 1,
                height: `${HOUR_HEIGHT}px`,
                paddingRight: "6px",
                paddingTop: "2px",
              }}
            >
              {hour}
            </div>
          ))}

          {/* Hour grid lines + appointments per day */}
          {days.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className="relative border-r"
              style={{ gridRow: "2 / -1", gridColumn: dayIndex + 2 }}
            >
              {/* Hour lines */}
              {hours.map((_, hourIndex) => (
                <div
                  key={hourIndex}
                  className="border-b border-dashed border-slate-100"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  onClick={() => handleSlotClick(day, START_HOUR + hourIndex)}
                />
              ))}

              {/* Appointments */}
              {(() => {
                const dayAppts =
                  appointmentsByDay.get(format(day, "yyyy-MM-dd")) || [];
                return dayAppts.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    patient={patientMap.get(appt.patient_id)}
                    service={serviceMap.get(appt.service_id || "")}
                    style={getCardStyle(appt)}
                    onClick={() => handleCardClick(appt)}
                    onStatusChange={(status) =>
                      handleStatusChange(appt.id, status)
                    }
                  />
                ));
              })()}
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <AppointmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          appointment={editingAppointment}
          defaultDate={selectedDate}
          defaultSlot={selectedSlot}
          patients={patients}
          services={services}
        />
      )}
    </>
  );
}
