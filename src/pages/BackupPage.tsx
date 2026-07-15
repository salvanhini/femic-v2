import { useState } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";

export default function BackupPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const TABLES = [
    "patients", "health_insurances", "services", "schedule_settings",
    "session_packages", "appointments", "session_movements",
    "clinical_anamneses", "clinical_evolutions", "femic_generated_documents",
    "clinic_rules", "assistant_tasks", "patient_form_responses",
    "whatsapp_inbox", "bot_mutes", "whatsapp_service_status",
  ];

  async function handleExport() {
    setExporting(true);
    try {
      const data: Record<string, unknown> = { exported_at: new Date().toISOString(), tables: {} };
      for (const table of TABLES) {
        const { data: rows } = await (getSupabase() as any).from(table).select("*");
        (data.tables as Record<string, unknown>)[table] = rows || [];
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `femic_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm("Restaurar backup? Isso substituirá os dados atuais. Faça um backup antes de continuar.")) {
      event.target.value = "";
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const tables = backup.tables || backup;
      const order = TABLES;

      for (const table of order) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const { error: delErr } = await (getSupabase() as any).from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) {
          for (const row of rows) {
            await (getSupabase() as any).from(table).upsert(row).maybeSingle();
          }
        } else {
          for (let i = 0; i < rows.length; i += 50) {
            const chunk = rows.slice(i, i + 50);
            const { error: insErr } = await (getSupabase() as any).from(table).insert(chunk);
            if (insErr) console.warn(`Insert error on ${table}:`, insErr);
          }
        }
      }
      toast.success("Backup restaurado com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function handleReset() {
    if (!confirm("Isso fará um backup completo e depois limpará agendamentos, evoluções e documentos. Continuar?")) return;
    if (!confirm("TEM CERTEZA? Essa ação não pode ser desfeita.")) return;
    setResetting(true);
    try {
      await handleExport();
      const clearTables = ["appointments", "session_movements", "session_packages", "clinical_evolutions", "femic_generated_documents", "assistant_tasks"];
      for (const table of clearTables) {
        const { error } = await (getSupabase() as any).from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) console.warn(`Erro ao limpar ${table}:`, error);
      }
      toast.success("Backup exportado e dados anuais removidos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no reset anual");
    } finally {
      setResetting(false);
      setShowReset(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold">Backup</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="text-4xl mb-3">📦</div>
          <h3 className="mb-2 text-lg font-bold">Exportar</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Baixa todas as tabelas do Supabase em um arquivo JSON. Inclui pacientes, agenda, pacotes, documentos e configurações.
          </p>
          <button
            className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 shadow-md"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exportando..." : "Exportar Backup"}
          </button>
        </div>

        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="text-4xl mb-3">📥</div>
          <h3 className="mb-2 text-lg font-bold">Importar</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Restaura dados a partir de um arquivo JSON de backup. Substitui os dados atuais.
          </p>
          <label className="block w-full cursor-pointer rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 shadow-md">
            {importing ? "Importando..." : "Escolher arquivo"}
            <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-2 font-bold">Tabelas incluídas ({TABLES.length})</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {TABLES.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-card">
        <button
          className="flex w-full items-center justify-between p-4 text-left"
          onClick={() => setShowReset(!showReset)}
        >
          <span className="text-sm font-bold text-red-600">⚡ Reset Anual</span>
          <span className="text-xs text-muted-foreground">{showReset ? "▲ Recolher" : "▼ Expandir"}</span>
        </button>
        {showReset && (
          <div className="border-t border-red-200 p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Faz um backup completo e depois limpa agendamentos, evoluções, documentos e tarefas.
              Pacientes, serviços, convênios e configurações são preservados.
              <strong className="block mt-2 text-red-600">Use apenas no fim do ciclo anual.</strong>
            </p>
            <button
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-50"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Executando..." : "Backup + Reset Anual"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}