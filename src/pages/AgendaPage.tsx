import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WeekView } from "@/components/agenda/WeekView";
import { MonthView } from "@/components/agenda/MonthView";
import { DayView } from "@/components/agenda/DayView";
import { AppointmentModal } from "@/components/agenda/AppointmentModal";
import { useAppointments, useMonthAppointments } from "@/hooks/use-appointments";
import { cancelUpcomingAppointments, fetchUpcomingActiveAppointments } from "@/lib/supabase/queries/appointments";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/utils/date";
import type { Appointment } from "@/lib/types/database";

type ViewMode = "week" | "month" | "day";

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelPatientId, setBulkCancelPatientId] = useState("");

  const { data: weekAppointments } = useAppointments(currentDate);
  const { data: monthAppointments } = useMonthAppointments(
    currentDate.getFullYear(),
    currentDate.getMonth()
  );
  const { data: patients = [] } = usePatients();
  const { data: services = [] } = useServices();
  const { data: upcomingAppointments = [], isFetching: isLoadingUpcoming } = useQuery({
    queryKey: ["upcoming_active_appointments", bulkCancelPatientId],
    queryFn: () => fetchUpcomingActiveAppointments(bulkCancelPatientId),
    enabled: bulkCancelOpen && !!bulkCancelPatientId,
  });

  const bulkCancelMutation = useMutation({
    mutationFn: () => cancelUpcomingAppointments(bulkCancelPatientId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming_active_appointments"] });
      setBulkCancelOpen(false);
      setBulkCancelPatientId("");
      toast.success(`${count} agendamento(s) futuro(s) cancelado(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível cancelar os agendamentos"),
  });

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const rawAppointments = useMemo(() => {
    if (viewMode === "month") return monthAppointments || [];
    return weekAppointments || [];
  }, [viewMode, weekAppointments, monthAppointments]);

  const appointments = useMemo(() => {
    return rawAppointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (serviceFilter !== "all" && a.service_id !== serviceFilter) return false;
      return true;
    });
  }, [rawAppointments, statusFilter, serviceFilter]);

  function handleAppointmentClick(appointment: Appointment) {
    setEditingAppointment(appointment);
    setModalOpen(true);
  }

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.toLowerCase();
    return rawAppointments.filter((a) => {
      const p = patientMap.get(a.patient_id);
      const nameMatch = p?.name?.toLowerCase().includes(q);
      const dateMatch = a.appointment_date.includes(q);
      return nameMatch || dateMatch;
    });
  }, [searchText, rawAppointments, patientMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
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

          <select
            className="rounded-lg border px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos status</option>
            <option value="agendado">Agendado</option>
            <option value="confirmado">Confirmado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            className="rounded-lg border px-2 py-1.5 text-sm max-w-[160px]"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="all">Todos serviços</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBulkCancelOpen(true)}>
            Cancelar em massa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
            Buscar Agendamentos
          </Button>
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

      <Dialog open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearchText(""); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div>
              <DialogDescription>Agenda FEMIC</DialogDescription>
              <DialogTitle>Buscar Agendamentos</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2 text-sm mb-4"
              placeholder="Buscar por nome do paciente ou data (YYYY-MM-DD)..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              autoFocus
            />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {searchText ? "Nenhum resultado encontrado." : "Digite para buscar..."}
                </p>
              ) : (
                searchResults.map((a) => {
                  const p = patientMap.get(a.patient_id);
                  const s = serviceMap.get(a.service_id || "");
                  return (
                    <div
                      key={a.id}
                      className="cursor-pointer rounded-lg border bg-card p-3 text-sm hover:bg-accent"
                      onClick={() => {
                        setEditingAppointment(a);
                        setModalOpen(true);
                        setSearchOpen(false);
                        setSearchText("");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{p?.name || "—"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          a.status === "cancelado" ? "bg-red-50 text-red-600" :
                          a.status === "concluido" ? "bg-green-50 text-green-600" :
                          a.status === "confirmado" ? "bg-blue-50 text-blue-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {fmtDate(a.appointment_date)} às {a.start_time.slice(0, 5)} — {s?.name || "—"}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCancelOpen} onOpenChange={(open) => {
        setBulkCancelOpen(open);
        if (!open) setBulkCancelPatientId("");
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div>
              <DialogDescription>Agenda FEMIC</DialogDescription>
              <DialogTitle>Cancelar agendamentos em massa</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">Esta ação cancela apenas os próximos atendimentos agendados ou confirmados. Atendimentos concluídos e cancelados não serão alterados.</p>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Paciente</label>
              <select className="w-full rounded-lg border px-3 py-2.5 text-sm" value={bulkCancelPatientId} onChange={(event) => setBulkCancelPatientId(event.target.value)}>
                <option value="">Selecione...</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
              </select>
            </div>
            {bulkCancelPatientId && (
              <div className="rounded-lg border bg-muted/30 p-3">
                {isLoadingUpcoming ? <p className="text-sm text-muted-foreground">Buscando agendamentos...</p> : <>
                  <p className="text-sm font-bold">{upcomingAppointments.length} agendamento(s) serão cancelados</p>
                  {upcomingAppointments.length > 0 && (
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {upcomingAppointments.map((appointment) => <li key={appointment.id}>{fmtDate(appointment.appointment_date)} às {appointment.start_time.slice(0, 5)}</li>)}
                    </ul>
                  )}
                </>}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCancelOpen(false)}>Voltar</Button>
            <Button variant="destructive" disabled={!bulkCancelPatientId || isLoadingUpcoming || upcomingAppointments.length === 0 || bulkCancelMutation.isPending} onClick={() => {
              const patientName = patientMap.get(bulkCancelPatientId)?.name || "este paciente";
              if (confirm(`Cancelar ${upcomingAppointments.length} agendamento(s) de ${patientName}?`)) bulkCancelMutation.mutate();
            }}>
              {bulkCancelMutation.isPending ? "Cancelando..." : "Cancelar agendamentos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
