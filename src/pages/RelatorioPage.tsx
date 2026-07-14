import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useQuery } from "@tanstack/react-query";
import { fetchAppointments } from "@/lib/supabase/queries/appointments";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import { fmtTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export default function RelatorioPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const from = `${month}-01`;
  const to = (() => {
    const [y, m] = month.split("-").map(Number);
    return endOfMonth(new Date(y!, m! - 1)).toISOString().slice(0, 10);
  })();

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", "report", from, to],
    queryFn: () => fetchAppointments(from, to),
  });

  const { data: patients = [] } = usePatients();
  const { data: services = [] } = useServices();

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );
  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services]
  );

  const kpis = useMemo(() => {
    const total = appointments.length;
    const agendado = appointments.filter((a) => a.status === "agendado").length;
    const confirmado = appointments.filter((a) => a.status === "confirmado").length;
    const concluido = appointments.filter((a) => a.status === "concluido").length;
    const cancelado = appointments.filter((a) => a.status === "cancelado").length;
    return { total, agendado, confirmado, concluido, cancelado };
  }, [appointments]);

  const statusLabels: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  const sortedAppointments = [...appointments].sort(
    (a, b) =>
      a.appointment_date.localeCompare(b.appointment_date) ||
      a.start_time.localeCompare(b.start_time)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold">Relatório Mensal</h2>
        <input
          type="month"
          className="rounded-lg border px-3 py-1.5 text-sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total" value={String(kpis.total)} color="text-slate-700" />
        <KpiCard label="Agendados" value={String(kpis.agendado)} color="text-amber-600" />
        <KpiCard label="Confirmados" value={String(kpis.confirmado)} color="text-blue-600" />
        <KpiCard label="Concluídos" value={String(kpis.concluido)} color="text-green-600" />
        <KpiCard label="Cancelados" value={String(kpis.cancelado)} color="text-red-500" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Horário</th>
              <th className="px-4 py-3 font-bold">Paciente</th>
              <th className="px-4 py-3 font-bold">Serviço</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sortedAppointments.map((appt) => {
              const patient = patientMap.get(appt.patient_id);
              const service = serviceMap.get(appt.service_id || "");

              return (
                <tr key={appt.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    {format(new Date(appt.appointment_date + "T00:00:00"), "dd/MM")}
                  </td>
                  <td className="px-4 py-2.5">
                    {fmtTime(appt.start_time)}–{fmtTime(appt.end_time)}
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {patient?.name || appt.patient_id}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {service?.name || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        appt.status === "cancelado" && "bg-red-100 text-red-700",
                        appt.status === "concluido" && "bg-green-100 text-green-700",
                        appt.status === "confirmado" && "bg-blue-100 text-blue-700",
                        appt.status === "agendado" && "bg-amber-100 text-amber-700"
                      )}
                    >
                      {statusLabels[appt.status] || appt.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {Number(appt.service_price_at_time || 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              );
            })}
            {sortedAppointments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum agendamento neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
