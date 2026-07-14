import { useQuery } from "@tanstack/react-query";
import { fetchAppointments } from "@/lib/supabase/queries/appointments";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import { todayIso, fmtTime } from "@/lib/utils/date";
import { startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const today = todayIso();
  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(new Date()).toISOString().slice(0, 10);

  const { data: todayAppts = [] } = useQuery({
    queryKey: ["appointments", "today", today],
    queryFn: () =>
      fetchAppointments(today, today),
  });

  const { data: monthAppts = [] } = useQuery({
    queryKey: ["appointments", "month", monthStart, monthEnd],
    queryFn: () => fetchAppointments(monthStart, monthEnd),
  });

  const { data: patients = [] } = usePatients();
  const { data: services = [] } = useServices();

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const todaySorted = [...todayAppts].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const monthKpis = {
    total: monthAppts.length,
    agendado: monthAppts.filter((a) => a.status === "agendado").length,
    confirmado: monthAppts.filter((a) => a.status === "confirmado").length,
    concluido: monthAppts.filter((a) => a.status === "concluido").length,
    cancelado: monthAppts.filter((a) => a.status === "cancelado").length,
  };

  const statusStyles: Record<string, string> = {
    cancelado: "bg-red-100 text-red-700 line-through opacity-70",
    concluido: "bg-green-100 text-green-700",
    agendado: "bg-amber-100 text-amber-700",
    confirmado: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Dashboard</h2>

      {/* Month KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Agendados" value={String(monthKpis.agendado)} color="text-amber-600" />
        <KpiCard label="Confirmados" value={String(monthKpis.confirmado)} color="text-blue-600" />
        <KpiCard label="Concluídos" value={String(monthKpis.concluido)} color="text-green-600" />
        <KpiCard label="Cancelados" value={String(monthKpis.cancelado)} color="text-red-500" />
      </div>

      {/* Today's appointments */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 font-bold">Atendimentos de hoje</h3>
        {todaySorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento hoje.</p>
        ) : (
          <div className="space-y-2">
            {todaySorted.map((appt) => {
              const patient = patientMap.get(appt.patient_id);
              const service = serviceMap.get(appt.service_id || "");
              return (
                <div
                  key={appt.id}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <span className="min-w-[60px] text-sm font-bold">
                    {fmtTime(appt.start_time)}
                  </span>
                  <span className="flex-1 font-medium">
                    {patient?.name || "Paciente"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {service?.name || "—"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      statusStyles[appt.status] || ""
                    )}
                  >
                    {appt.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-4 font-bold">Alertas</h3>
        <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>
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
      <p className={`mt-1 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}
