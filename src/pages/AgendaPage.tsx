import { useState, useMemo } from "react";
import { WeekView } from "@/components/agenda/WeekView";
import { MonthView } from "@/components/agenda/MonthView";
import { DayView } from "@/components/agenda/DayView";
import { AppointmentModal } from "@/components/agenda/AppointmentModal";
import { useAppointments, useMonthAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import type { Appointment } from "@/lib/types/database";

type ViewMode = "week" | "month" | "day";

export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const { data: weekAppointments, isLoading: loadingWeek } = useAppointments(currentDate);
  const { data: monthAppointments, isLoading: loadingMonth } = useMonthAppointments(
    currentDate.getFullYear(),
    currentDate.getMonth()
  );
  const { data: patients = [] } = usePatients();
  const { data: services = [] } = useServices();

  const appointments = useMemo(() => {
    if (viewMode === "month") return monthAppointments || [];
    return weekAppointments || [];
  }, [viewMode, weekAppointments, monthAppointments]);

  function handleAppointmentClick(appointment: Appointment) {
    setEditingAppointment(appointment);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* View switcher */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border p-0.5">
          {(["week", "month", "day"] as const).map((mode) => (
            <button
              key={mode}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === "week" ? "Semana" : mode === "month" ? "Mês" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "week" && (
        <WeekView
          currentDate={currentDate}
          appointments={appointments}
          patients={patients}
          services={services}
          onDateChange={setCurrentDate}
        />
      )}

      {viewMode === "month" && (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          patients={patients}
          services={services}
          onDateChange={setCurrentDate}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {viewMode === "day" && (
        <DayView
          date={currentDate}
          appointments={appointments}
          patients={patients}
          services={services}
          onDateChange={setCurrentDate}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {modalOpen && (
        <AppointmentModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingAppointment(null);
          }}
          appointment={editingAppointment}
          defaultDate=""
          defaultSlot=""
          patients={patients}
          services={services}
        />
      )}
    </div>
  );
}
