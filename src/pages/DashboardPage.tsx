import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAppointments } from "@/lib/supabase/queries/appointments";
import { fetchSessionPackages } from "@/lib/supabase/queries/services";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import { todayIso, fmtTime } from "@/lib/utils/date";
import { startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Settings2, CalendarDays, UsersRound, CheckCircle2, Clock3, XCircle } from "lucide-react";

const STORAGE_KEY = "femic_dashboard_thresholds";

function loadThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Mantém os limites padrão quando o navegador não puder ler o armazenamento local.
  }
  return { critical: 3, low: 5 };
}

function saveThresholds(t: { critical: number; low: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export default function DashboardPage() {
  const today = todayIso();
  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(new Date()).toISOString().slice(0, 10);

  const [thresholds, setThresholds] = useState(loadThresholds);
  const [editingThresholds, setEditingThresholds] = useState(false);
  const [tempCritical, setTempCritical] = useState(String(thresholds.critical));
  const [tempLow, setTempLow] = useState(String(thresholds.low));

  const { data: todayAppts = [] } = useQuery({
    queryKey: ["appointments", "today", today],
    queryFn: () => fetchAppointments(today, today),
  });

  const { data: monthAppts = [] } = useQuery({
    queryKey: ["appointments", "month", monthStart, monthEnd],
    queryFn: () => fetchAppointments(monthStart, monthEnd),
  });

  const { data: allAppts = [] } = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => fetchAppointments("2020-01-01", "2099-12-31"),
  });

  const { data: patients = [] } = usePatients();
  const { data: services = [] } = useServices();
  const { data: packages = [] } = useQuery({
    queryKey: ["session_packages"],
    queryFn: fetchSessionPackages,
  });

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

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

  // Pacotes com sessões baixas
  const criticalPackages = packages.filter((p) => {
    const remaining = p.remaining_sessions ?? 0;
    return remaining > 0 && remaining <= thresholds.critical && p.active;
  });

  const lowPackages = packages.filter((p) => {
    const remaining = p.remaining_sessions ?? 0;
    return remaining > thresholds.critical && remaining <= thresholds.low && p.active;
  });

  const emptyPackages = packages.filter((p) => {
    const remaining = p.remaining_sessions ?? 0;
    return remaining === 0 && p.active;
  });

  // Último agendamento por paciente (pacientes ativos com pacote)
  const lastAppointmentAlerts = useMemo(() => {
    const activePatientIds = new Set(
      packages.filter((p) => p.active && (p.remaining_sessions ?? 0) > 0).map((p) => p.patient_id)
    );

    const alerts: { patientId: string; patientName: string; lastDate: string; hasFuture: boolean }[] = [];

    for (const pid of activePatientIds) {
      const patientAppts = allAppts
        .filter((a) => a.patient_id === pid)
        .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

      if (patientAppts.length === 0) continue;

      const lastAppt = patientAppts[0];
      if (!lastAppt) continue;

      const hasFuture = patientAppts.some(
        (a) => a.appointment_date >= today && a.status !== "cancelado"
      );

      if (!hasFuture) {
        alerts.push({
          patientId: pid,
          patientName: patientMap.get(pid)?.name || "Paciente",
          lastDate: lastAppt.appointment_date,
          hasFuture: false,
        });
      }
    }

    return alerts;
  }, [allAppts, packages, patientMap, today]);

  function saveThresholdsAndClose() {
    const c = Math.max(1, parseInt(tempCritical) || 3);
    const l = Math.max(c + 1, parseInt(tempLow) || 5);
    const newT = { critical: c, low: l };
    setThresholds(newT);
    saveThresholds(newT);
    setTempCritical(String(c));
    setTempLow(String(l));
    setEditingThresholds(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-femic-cyan">Visão geral</p>
        <h2 className="text-2xl font-bold tracking-tight">Sua clínica hoje</h2>
        <p className="text-sm text-muted-foreground">Acompanhe atendimentos, pacientes e pontos de atenção.</p>
      </div>

      {/* Month KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Agendados" value={String(monthKpis.agendado)} color="text-amber-600" icon={Clock3} iconClass="bg-amber-100 text-amber-700" />
        <KpiCard label="Confirmados" value={String(monthKpis.confirmado)} color="text-blue-600" icon={CalendarDays} iconClass="bg-blue-100 text-blue-700" />
        <KpiCard label="Concluídos" value={String(monthKpis.concluido)} color="text-emerald-600" icon={CheckCircle2} iconClass="bg-emerald-100 text-emerald-700" />
        <KpiCard label="Cancelados" value={String(monthKpis.cancelado)} color="text-red-500" icon={XCircle} iconClass="bg-red-100 text-red-700" />
        <KpiCard label="Total de pacientes" value={String(patients.length)} color="text-slate-700" icon={UsersRound} iconClass="bg-slate-100 text-slate-700" />
      </div>

      {/* Today's appointments */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold">Atendimentos de hoje</h3>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{todaySorted.length} {todaySorted.length === 1 ? "consulta" : "consultas"}</span>
        </div>
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
                  className="flex items-center gap-4 rounded-xl border border-border/80 p-3 transition-colors hover:bg-muted/40"
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
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">Alertas</h3>
          <button
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setEditingThresholds(!editingThresholds)}
          >
            <Settings2 className="h-3 w-3" /> Limiares
          </button>
        </div>

        {editingThresholds && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <span>Crítico até</span>
            <input
              type="number"
              min="1"
              className="w-16 rounded border px-2 py-1 text-center text-sm"
              value={tempCritical}
              onChange={(e) => setTempCritical(e.target.value)}
            />
            <span>sessões</span>
            <span className="ml-2">Baixo até</span>
            <input
              type="number"
              min="2"
              className="w-16 rounded border px-2 py-1 text-center text-sm"
              value={tempLow}
              onChange={(e) => setTempLow(e.target.value)}
            />
            <span>sessões</span>
            <button
              className="ml-2 rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
              onClick={saveThresholdsAndClose}
            >
              Salvar
            </button>
          </div>
        )}

        {emptyPackages.length === 0 && criticalPackages.length === 0 && lowPackages.length === 0 && lastAppointmentAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>
        ) : (
          <div className="space-y-3">
            {criticalPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-700">
                  <strong>{patientMap.get(pkg.patient_id)?.name || "Paciente"}</strong> — pacote de sessões está acabando ({pkg.remaining_sessions} restantes)
                </p>
              </div>
            ))}
            {lowPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-sm font-medium text-amber-700">
                  <strong>{patientMap.get(pkg.patient_id)?.name || "Paciente"}</strong> — pacote com {pkg.remaining_sessions} sessões restantes
                </p>
              </div>
            ))}
            {emptyPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">
                  <strong>{patientMap.get(pkg.patient_id)?.name || "Paciente"}</strong> — pacote de sessões esgotado
                </p>
              </div>
            ))}
            {lastAppointmentAlerts.map((alert) => (
              <div
                key={alert.patientId}
                className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                <p className="text-sm font-medium text-purple-700">
                  <strong>{alert.patientName}</strong> — último atendimento em {alert.lastDate}. Considere agendar nova sessão.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof Clock3;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className={`mt-3 text-3xl font-black tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
