import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createAppointment, fetchAppointments } from "@/lib/supabase/queries/appointments";
import { fetchSessionPackages } from "@/lib/supabase/queries/services";
import { buildSessionReplacementAlert, type SessionReplacementAlert } from "@/lib/appointments/session-replacement";
import { usePatients } from "@/hooks/use-patients";
import { useServices } from "@/hooks/use-services";
import { todayIso, fmtDate, fmtTime } from "@/lib/utils/date";
import { startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Settings2, CalendarDays, UsersRound, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const queryClient = useQueryClient();
  const today = todayIso();
  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(new Date()).toISOString().slice(0, 10);

  const [thresholds, setThresholds] = useState(loadThresholds);
  const [editingThresholds, setEditingThresholds] = useState(false);
  const [tempCritical, setTempCritical] = useState(String(thresholds.critical));
  const [tempLow, setTempLow] = useState(String(thresholds.low));
  const [replacementAlert, setReplacementAlert] = useState<SessionReplacementAlert | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());

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

  const replacementAlerts = useMemo(
    () => packages
      .map((pkg) => buildSessionReplacementAlert(pkg, allAppts, today))
      .filter((alert): alert is SessionReplacementAlert => !!alert),
    [allAppts, packages, today]
  );

  const createReplacementMutation = useMutation({
    mutationFn: async () => {
      if (!replacementAlert) throw new Error("Nenhuma reposição selecionada");
      const selected = replacementAlert.suggestions.filter((suggestion) => selectedSuggestionIds.has(suggestion.id));
      if (!selected.length) throw new Error("Selecione ao menos uma sessão para criar");

      for (const suggestion of selected) {
        await createAppointment({
          patient_id: suggestion.patient_id,
          service_id: suggestion.service_id,
          appointment_date: suggestion.appointment_date,
          start_time: suggestion.start_time,
          end_time: suggestion.end_time,
          duration_minutes: suggestion.duration_minutes,
          service_price_at_time: suggestion.service_price_at_time,
          status: "agendado",
          notes: "Reposição automática de sessão do pacote",
        });
      }
      return selected.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setReplacementAlert(null);
      setSelectedSuggestionIds(new Set());
      toast.success(`${count} sessão(ões) adicionada(s) à agenda`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível criar as sessões"),
  });

  function openReplacement(alert: SessionReplacementAlert) {
    setReplacementAlert(alert);
    setSelectedSuggestionIds(new Set(
      alert.suggestions
        .filter((suggestion) => suggestion.conflicting_appointment_ids.length === 0)
        .map((suggestion) => suggestion.id)
    ));
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

        {emptyPackages.length === 0 && criticalPackages.length === 0 && lowPackages.length === 0 && replacementAlerts.length === 0 ? (
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
            {replacementAlerts.map((alert) => (
              <div
                key={alert.package.id}
                className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-purple-700">
                    <strong>{patientMap.get(alert.package.patient_id)?.name || "Paciente"}</strong> — faltam agendar {alert.missing_count} sessão(ões) do pacote.
                  </p>
                  <Button size="sm" variant="outline" className="border-purple-300 bg-white text-purple-700 hover:bg-purple-100" onClick={() => openReplacement(alert)}>
                    Completar sessões
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!replacementAlert} onOpenChange={(open) => !open && setReplacementAlert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div>
              <DialogDescription>Reposição de sessões do pacote</DialogDescription>
              <DialogTitle>{replacementAlert ? patientMap.get(replacementAlert.package.patient_id)?.name || "Paciente" : ""}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            {replacementAlert && (
              <div className="space-y-3">
                {replacementAlert.suggestions.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Não há histórico de sessões suficiente para sugerir horários. Crie o próximo agendamento manualmente.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Confira as sugestões antes de adicionar à agenda. Horários com conflito começam desmarcados.</p>
                    {replacementAlert.suggestions.map((suggestion) => {
                      const conflicts = suggestion.conflicting_appointment_ids
                        .map((id) => allAppts.find((appointment) => appointment.id === id))
                        .filter((appointment) => !!appointment)
                        .map((appointment) => patientMap.get(appointment.patient_id)?.name || "Outro paciente");
                      const hasConflict = conflicts.length > 0;
                      return (
                        <label key={suggestion.id} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", hasConflict ? "border-amber-300 bg-amber-50" : "bg-card")}>
                          <input type="checkbox" checked={selectedSuggestionIds.has(suggestion.id)} onChange={() => toggleSuggestion(suggestion.id)} className="mt-1" />
                          <span className="min-w-0 flex-1 text-sm">
                            <strong>{fmtDate(suggestion.appointment_date)} às {fmtTime(suggestion.start_time)}</strong>
                            {hasConflict && <span className="mt-1 block text-xs text-amber-800">Conflito com: {conflicts.join(", ")}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplacementAlert(null)}>Cancelar</Button>
            <Button
              onClick={() => createReplacementMutation.mutate()}
              disabled={!replacementAlert?.suggestions.length || selectedSuggestionIds.size === 0 || createReplacementMutation.isPending}
            >
              {createReplacementMutation.isPending ? "Adicionando..." : `Adicionar ${selectedSuggestionIds.size} sessão(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
