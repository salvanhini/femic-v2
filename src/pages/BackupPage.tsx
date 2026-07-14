import { useState } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";

export default function BackupPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const TABLES = [
    "patients",
    "health_insurances",
    "services",
    "schedule_settings",
    "session_packages",
    "appointments",
    "session_movements",
    "clinical_anamneses",
    "clinical_evolutions",
    "femic_generated_documents",
    "clinic_rules",
    "assistant_tasks",
    "patient_form_responses",
  ];

  async function handleExport() {
    setExporting(true);
    try {
      const data: Record<string, unknown> = { exported_at: new Date().toISOString(), tables: {} };
      for (const table of TABLES) {
        const { data: rows } = await getSupabase().from(table).select("*");
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
    if (
      !confirm(
        "Restaurar backup? Isso substituirá os dados atuais. Faça um backup antes de continuar."
      )
    ) {
      event.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const tables = backup.tables || backup;
      const order = [
        "patients",
        "health_insurances",
        "services",
        "schedule_settings",
        "session_packages",
        "appointments",
        "clinical_anamneses",
        "clinical_evolutions",
        "session_movements",
        "femic_generated_documents",
        "clinic_rules",
        "assistant_tasks",
        "patient_form_responses",
      ];

      for (const table of order) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        // Delete existing and reinsert
        const { error: delErr } = await getSupabase().from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) {
          // Try upsert instead if delete fails
          for (const row of rows) {
            await getSupabase().from(table).upsert(row).maybeSingle();
          }
        } else {
          // Chunk insert to avoid payload limits
          for (let i = 0; i < rows.length; i += 50) {
            const chunk = rows.slice(i, i + 50);
            const { error: insErr } = await getSupabase().from(table).insert(chunk);
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Backup</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-2 font-bold">Exportar dados</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Baixa todas as tabelas do Supabase em um arquivo JSON.
          </p>
          <button
            className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exportando..." : "Exportar Backup"}
          </button>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-2 font-bold">Importar dados</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Restaura dados a partir de um arquivo JSON de backup.
          </p>
          <label className="cursor-pointer rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {importing ? "Importando..." : "Escolher arquivo"}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-2 font-bold">Tabelas incluídas</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {TABLES.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
