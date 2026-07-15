import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAppointments, updateAppointment } from "@/lib/supabase/queries/appointments";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchServices } from "@/lib/supabase/queries/services";
import { fmtDate, todayIso } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/types/database";

function waLink(phone: string, text: string) {
  const p = phone.replace(/\D/g, "");
  return `https://wa.me/55${p}?text=${encodeURIComponent(text)}`;
}

const REMINDER_TEMPLATE = (name: string, date: string, time: string, service: string) =>
  `Olá ${name}! 👋\n\nPassando para lembrar da sua sessão de *${service}* na FEMIC Fisioterapia:\n\n📅 *${date}* às *${time}*\n\nConfirme sua presença respondendo esta mensagem.\n\nAté lá! 😊`;

export default function LembretesPage() {
  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState("all");

  const from = filterDate;
  const to = filterDate;

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", from, to],
    queryFn: () => fetchAppointments(from, to),
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
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const filtered = (appointments as Appointment[]).filter((a) => {
    if (statusFilter === "pending" && a.reminder_sent) return false;
    if (statusFilter === "sent" && !a.reminder_sent) return false;
    if (statusFilter === "concluido" && a.status !== "concluido") return false;
    if (statusFilter === "cancelado" && a.status !== "cancelado") return false;
    if (!["concluido", "cancelado"].includes(a.status)) return true;
    return false;
  });

  const markSentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      await updateAppointment(appointmentId, {
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Lembrete marcado como enviado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar"),
  });

  function handleSendWhatsApp(appt: Appointment) {
    const patient = patientMap.get(appt.patient_id);
    if (!patient?.whatsapp) {
      toast.error("Paciente sem WhatsApp cadastrado");
      return;
    }
    const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
    const msg = REMINDER_TEMPLATE(
      patient.name,
      fmtDate(appt.appointment_date),
      appt.start_time.slice(0, 5),
      service?.name || "Fisioterapia"
    );
    window.open(waLink(patient.whatsapp, msg), "_blank");
    markSentMutation.mutate(appt.id);
  }

  const pendingCount = filtered.filter((a) => !a.reminder_sent).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          Lembretes WhatsApp
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white align-middle">
              {pendingCount} pendentes
            </span>
          )}
        </h2>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Data</label>
          <input
            type="date"
            className="rounded-lg border px-3 py-2 text-sm"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Filtro</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="pending">Não enviados</option>
            <option value="sent">Enviados</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum agendamento encontrado para esta data.
          </p>
        ) : (
          filtered.map((appt) => {
            const patient = patientMap.get(appt.patient_id);
            const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
            return (
              <div
                key={appt.id}
                className={`rounded-xl border bg-card p-4 ${
                  appt.reminder_sent ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{patient?.name || "—"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        appt.status === "concluido"
                          ? "bg-green-50 text-green-600"
                          : appt.status === "cancelado"
                          ? "bg-red-50 text-red-600"
                          : appt.status === "confirmado"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {appt.status === "agendado" ? "Agendado" : appt.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {fmtDate(appt.appointment_date)} às {appt.start_time.slice(0, 5)} — {service?.name || "—"}
                    </p>
                    {appt.reminder_sent && appt.reminder_sent_at && (
                      <p className="text-xs text-green-600">
                        ✅ Lembrete enviado em {fmtDate(appt.reminder_sent_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSendWhatsApp(appt)}
                      disabled={!patient?.whatsapp}
                      title={!patient?.whatsapp ? "Sem WhatsApp" : "Enviar lembrete"}
                    >
                      {patient?.whatsapp ? "Enviar WhatsApp" : "Sem WhatsApp"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
