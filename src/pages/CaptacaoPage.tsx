import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchTasks, updateTask } from "@/lib/supabase/queries/assistants";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { createAppointment } from "@/lib/supabase/queries/appointments";
import { fetchServices } from "@/lib/supabase/queries/services";
import { fmtDate, todayIso, addDays, addMinutes } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AssistantTask, Service } from "@/lib/types/database";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function waLink(phone: string, text: string) {
  const p = phone.replace(/\D/g, "");
  return `https://wa.me/55${p}?text=${encodeURIComponent(text)}`;
}

const WA_TEMPLATE = (name: string, date: string, time: string) =>
  `Olá ${name}, tudo bem? 😊\n\nSua avaliação na FEMIC Fisioterapia foi agendada para *${date} às ${time}*.\n\nConfirme sua presença respondendo esta mensagem.\n\nQualquer dúvida, estamos à disposição!`;

export default function CaptacaoPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<AssistantTask | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(addDays(todayIso(), 1));
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleService, setScheduleService] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["assistant_tasks", "captacao"],
    queryFn: () => fetchTasks({ origin: "captacao_publica" }),
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const filtered = (tasks as AssistantTask[]).filter((t) =>
    !search || t.patient_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingTasks = filtered.filter((t) => t.status !== "scheduled");

  const clearPendingMutation = useMutation({
    mutationFn: async () => {
      const pending = (tasks as AssistantTask[]).filter((t) => t.status !== "scheduled");
      for (const t of pending) {
        await updateTask(t.id, { status: "done" });
      }
      return pending.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["assistant_tasks"] });
      toast.success(`${count} pendência(s) limpa(s)`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !selectedTask.patient_id) return;
      const service = services.find((s: Service) => s.id === scheduleService);
      const endTime = addMinutes(scheduleTime, service?.duration_minutes || 45);

      const appointment = await createAppointment({
        patient_id: selectedTask.patient_id,
        service_id: scheduleService || null,
        appointment_date: scheduleDate,
        start_time: scheduleTime,
        end_time: endTime,
        status: "agendado",
        service_price_at_time: service?.price || 0,
        duration_minutes: service?.duration_minutes || 45,
      });

      await updateTask(selectedTask.id, {
        status: "scheduled",
        notes: `Agendado para ${scheduleDate} às ${scheduleTime}`,
      });

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["assistant_tasks"] });
      toast.success("Avaliação agendada com sucesso");
      setScheduleOpen(false);
      setSelectedTask(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar");
    },
  });

  function handleWhatsApp(task: AssistantTask) {
    const phone = task.phone;
    if (!phone) {
      toast.error("Paciente sem WhatsApp cadastrado");
      return;
    }
    const msg = WA_TEMPLATE(task.patient_name || "", "", "");
    window.open(waLink(phone, msg), "_blank");
  }

  function openSchedule() {
    if (!selectedTask) return;
    if (!selectedTask.patient_id) {
      toast.error("Paciente não vinculado");
      return;
    }
    setScheduleDate(addDays(todayIso(), 1));
    setScheduleTime("08:00");
    setScheduleService("");
    setScheduleOpen(true);
  }

  const taskPatient = selectedTask?.patient_id
    ? patientMap.get(selectedTask.patient_id)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          Captação de Pacientes
          {pendingTasks.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white align-middle">
              {pendingTasks.length} pendentes
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          {pendingTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                if (confirm(`Limpar ${pendingTasks.length} pendência(s)?`)) {
                  clearPendingMutation.mutate();
                }
              }}
              disabled={clearPendingMutation.isPending}
            >
              Limpar pendências
            </Button>
          )}
          <input
            type="text"
            className="w-56 rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar por paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhuma solicitação de captação.
          </p>
        ) : (
          filtered.map((t: AssistantTask) => (
            <div
              key={t.id}
              className="cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
              onClick={() => setSelectedTask(t)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{t.patient_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.status === "scheduled"
                        ? "bg-green-50 text-green-600"
                        : "bg-amber-50 text-amber-600"
                    }`}>
                      {t.status === "scheduled" ? "Agendado" : "Pendente"}
                    </span>
                  </div>
                  {t.created_at && (
                    <p className="text-sm text-muted-foreground">
                      {fmtDate(t.created_at)}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 text-sm">
                  {t.service_name && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 font-bold text-purple-600">
                      {t.service_name}
                    </span>
                  )}
                  {t.phone && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-600">
                      {formatPhone(t.phone)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div>
              <DialogDescription>Solicitação de avaliação</DialogDescription>
              <DialogTitle>{selectedTask?.patient_name}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            {selectedTask && (
              <div className="space-y-4">
                {selectedTask.notes && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Observações</p>
                    <p className="text-sm">{selectedTask.notes}</p>
                  </div>
                )}

                {selectedTask.service_name && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Serviço</p>
                    <p className="text-sm capitalize">{selectedTask.service_name}</p>
                  </div>
                )}

                {selectedTask.suggested_slots && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Preferência de horário</p>
                    <p className="text-sm">
                      {(() => {
                        try {
                          const slots = typeof selectedTask.suggested_slots === "string"
                            ? JSON.parse(selectedTask.suggested_slots)
                            : selectedTask.suggested_slots;
                          if (Array.isArray(slots) && slots.length > 0) {
                            const s = slots[0];
                            const days: Record<string, string> = {
                              segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira",
                              quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado",
                            };
                            return `${days[s.day] || s.day} - ${s.period === "manha" ? "Manhã" : "Tarde"}`;
                          }
                        } catch {}
                        return "—";
                      })()}
                    </p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <p>WhatsApp: {selectedTask.phone ? formatPhone(selectedTask.phone) : "—"}</p>
                  <p>Status: {selectedTask.status === "scheduled" ? "Agendado" : "Pendente"}</p>
                  {selectedTask.created_at && (
                    <p>Solicitado em: {fmtDate(selectedTask.created_at)}</p>
                  )}
                  {taskPatient && (
                    <p>Paciente vinculado: {taskPatient.name}</p>
                  )}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="flex-wrap gap-2">
            {selectedTask?.status !== "scheduled" && (
              <Button onClick={openSchedule} disabled={!selectedTask?.patient_id}>
                Agendar Avaliação
              </Button>
            )}
            {selectedTask?.phone && (
              <Button variant="outline" onClick={() => handleWhatsApp(selectedTask)}>
                WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={(open) => !open && setScheduleOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div>
              <DialogDescription>Agendar avaliação</DialogDescription>
              <DialogTitle>{selectedTask?.patient_name}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold">Data</label>
                <input
                  type="date"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={todayIso()}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">Horário</label>
                <input
                  type="time"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">Serviço</label>
                <select
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  value={scheduleService}
                  onChange={(e) => setScheduleService(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {services.map((s: Service) => (
                    <option key={s.id} value={s.id}>{s.name} — R$ {Number(s.price || 0).toFixed(2)}</option>
                  ))}
                </select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending || !scheduleService}
            >
              {scheduleMutation.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
