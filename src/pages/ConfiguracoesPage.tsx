import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { fetchScheduleSettings } from "@/lib/supabase/queries/services";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { ScheduleSettings } from "@/lib/types/database";
import ServicosPage from "@/pages/ServicosPage";
import { configureClinicalAi, getClinicalAiConfig, type ClinicalAiProvider } from "@/lib/ai/clinical-ai";

const DAYS = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

const CHECK_TABLES = [
  "patients", "services", "health_insurances", "appointments",
  "session_packages", "session_movements", "clinical_anamneses",
  "clinical_evolutions", "femic_generated_documents", "assistant_tasks",
  "schedule_settings", "clinic_rules", "whatsapp_inbox", "bot_mutes",
  "whatsapp_service_status",
];

interface TableStatus {
  name: string;
  ok: boolean;
  count: number;
  error?: string;
}

type SettingsTab = "schedule" | "services" | "health" | "ai";

const AI_MODELS: Record<ClinicalAiProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "google/gemini-2.0-flash-001",
  gemini: "gemini-2.0-flash",
};

const tabFromSearchParam: Record<string, SettingsTab> = {
  horarios: "schedule",
  servicos: "services",
  saude: "health",
  ia: "ai",
};

const searchParamFromTab: Record<SettingsTab, string> = {
  schedule: "horarios",
  services: "servicos",
  health: "saude",
  ai: "ia",
};

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>(
    tabFromSearchParam[searchParams.get("aba") || ""] || "schedule"
  );

  const { data: settings } = useQuery({
    queryKey: ["schedule_settings"],
    queryFn: fetchScheduleSettings,
  });

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [slotInterval, setSlotInterval] = useState("30");
  const [maxPatients, setMaxPatients] = useState("4");
  const [selectedDays, setSelectedDays] = useState<string[]>(["1", "2", "3", "4", "5"]);

  // Health check state
  const [healthResults, setHealthResults] = useState<TableStatus[]>([]);
  const [checking, setChecking] = useState(false);
  const storedAiConfig = getClinicalAiConfig();
  const [aiProvider, setAiProvider] = useState<ClinicalAiProvider>(storedAiConfig?.provider || "groq");
  const [aiApiKey, setAiApiKey] = useState(storedAiConfig?.apiKey || "");
  const [aiModel, setAiModel] = useState(storedAiConfig?.model || AI_MODELS[storedAiConfig?.provider || "groq"]);

  useEffect(() => {
    if (settings) {
      setStartTime(settings.start_time || "08:00");
      setEndTime(settings.end_time || "18:00");
      setSlotInterval(String(settings.slot_interval_minutes || 30));
      setMaxPatients(String(settings.max_patients_per_slot || 4));
      setSelectedDays(settings.working_days ? settings.working_days.split(",") : ["1", "2", "3", "4", "5"]);
    }
  }, [settings]);

  useEffect(() => {
    const tabFromUrl = tabFromSearchParam[searchParams.get("aba") || ""] || "schedule";
    setTab((currentTab) => currentTab === tabFromUrl ? currentTab : tabFromUrl);
  }, [searchParams]);

  function selectTab(nextTab: SettingsTab) {
    setTab(nextTab);
    setSearchParams(nextTab === "schedule" ? {} : { aba: searchParamFromTab[nextTab] });
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ScheduleSettings>) => {
      if (settings?.id) {
        await getSupabase().from("schedule_settings").update(data as never).eq("id", settings.id);
      } else {
        await getSupabase().from("schedule_settings").insert(data as never);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_settings"] });
      toast.success("Configurações salvas");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSave() {
    saveMutation.mutate({
      id: settings?.id || undefined,
      start_time: startTime,
      end_time: endTime,
      working_days: selectedDays.join(","),
      slot_interval_minutes: Number(slotInterval) || 30,
      max_patients_per_slot: Number(maxPatients) || 4,
    });
  }

  function handleAiProviderChange(provider: ClinicalAiProvider) {
    setAiProvider(provider);
    setAiModel(AI_MODELS[provider]);
  }

  function handleSaveAi() {
    configureClinicalAi({ provider: aiProvider, apiKey: aiApiKey, model: aiModel });
    toast.success(aiApiKey.trim() ? "Configuração de IA salva neste navegador" : "Configuração local removida; a IA usará o servidor");
  }

  async function handleHealthCheck() {
    setChecking(true);
    const supabase = getSupabase();
    const statuses: TableStatus[] = [];
    for (const table of CHECK_TABLES) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        statuses.push({
          name: table,
          ok: !error,
          count: count || 0,
          error: error?.message,
        });
      } catch (err) {
        statuses.push({
          name: table,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : "Erro",
        });
      }
    }
    setHealthResults(statuses);
    setChecking(false);
  }

  const totalOk = healthResults.filter((r) => r.ok).length;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Configurações</h2>

      <div className="flex gap-1 border-b">
        <button
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === "schedule" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          }`}
          onClick={() => selectTab("schedule")}
        >
          Horários
        </button>
        <button
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === "services" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          }`}
          onClick={() => selectTab("services")}
        >
          Serviços
        </button>
        <button
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === "health" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          }`}
          onClick={() => selectTab("health")}
        >
          Saúde do Sistema
        </button>
        <button
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === "ai" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          }`}
          onClick={() => selectTab("ai")}
        >
          IA
        </button>
      </div>

      {tab === "schedule" && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 font-bold">Horários de Funcionamento</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Abertura</label>
              <input type="time" className="w-full rounded-lg border px-3 py-2 text-sm" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Fechamento</label>
              <input type="time" className="w-full rounded-lg border px-3 py-2 text-sm" value={endTime}
                onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="mt-6">
            <label className="mb-2 block text-xs font-bold text-muted-foreground">Dias de Funcionamento</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button key={day.value} type="button" onClick={() => toggleDay(day.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    selectedDays.includes(day.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}>
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Intervalo entre slots (min)</label>
              <input type="number" min="5" step="5" className="w-full rounded-lg border px-3 py-2 text-sm"
                value={slotInterval} onChange={(e) => setSlotInterval(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Máx. pacientes por slot</label>
              <input type="number" min="1" className="w-full rounded-lg border px-3 py-2 text-sm"
                value={maxPatients} onChange={(e) => setMaxPatients(e.target.value)} />
            </div>
          </div>
          <div className="mt-6">
            <button className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground"
              onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}

      {tab === "services" && <ServicosPage />}

      {tab === "ai" && (
        <div className="max-w-2xl rounded-xl border bg-card p-6">
          <h3 className="font-bold">Assistente de IA</h3>
          <p className="mt-1 text-sm text-muted-foreground">Escolha o provedor e o modelo usados para organizar o prontuário.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Provedor</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={aiProvider} onChange={(event) => handleAiProviderChange(event.target.value as ClinicalAiProvider)}>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Modelo</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="Modelo do provedor" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Chave de API</label>
            <input type="password" autoComplete="off" className="w-full rounded-lg border px-3 py-2 text-sm" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder="Cole a chave do provedor escolhido" />
          </div>
          <p className="mt-3 text-xs text-amber-700">A chave é salva apenas neste navegador. Em computadores compartilhados, prefira manter a chave configurada no Supabase.</p>
          <div className="mt-5"><Button onClick={handleSaveAi}>Salvar configuração de IA</Button></div>
        </div>
      )}

      {tab === "health" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Diagnóstico do Sistema</h3>
              <Button onClick={handleHealthCheck} disabled={checking} size="sm">
                {checking ? "Verificando..." : "Verificar agora"}
              </Button>
            </div>
            {healthResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <span className={`h-3 w-3 rounded-full ${totalOk === healthResults.length ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-bold">{totalOk}/{healthResults.length} tabelas operacionais</span>
                </div>
                {healthResults.map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${r.ok ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="text-sm font-bold">{r.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {r.ok ? `${r.count} registro(s)` : (r.error?.includes("does not exist") ? "Tabela não criada" : "Erro")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {healthResults.length === 0 && !checking && (
              <p className="text-sm text-muted-foreground">Clique em "Verificar agora" para testar a conexão com o Supabase.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
