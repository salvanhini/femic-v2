import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients, createPatient, updatePatient } from "@/lib/supabase/queries/patients";
import { PatientChartModal } from "@/components/pacientes/PatientChartModal";
import type { Patient } from "@/lib/types/database";

export default function PacientesPage() {
  const queryClient = useQueryClient();
  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
  });

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [chartPatient, setChartPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState({ name: "", whatsapp: "", pathology: "", birth_date: "", referral_source: "" });

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (!showArchived && p.archived) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.whatsapp || "").includes(q)
      );
    });
  }, [patients, search, showArchived]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Patient>) => createPatient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente criado");
      setForm({ name: "", whatsapp: "", pathology: "", birth_date: "", referral_source: "" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Patient> }) =>
      updatePatient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente atualizado");
      setEditing(null);
      setForm({ name: "", whatsapp: "", pathology: "", birth_date: "", referral_source: "" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      updatePatient(id, { archived, archived_at: archived ? new Date().toISOString() : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("patients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente removido");
    },
    onError: (err) => {
      toast.error("Paciente possui vínculos. Use inativar.");
    },
  });

  function openEdit(p: Patient) {
    setEditing(p);
    setForm({ name: p.name, whatsapp: p.whatsapp || "", pathology: p.pathology || "", birth_date: p.birth_date || "", referral_source: p.referral_source || "" });
  }

  function handleSave() {
    if (!form.name.trim()) return toast.warning("Informe o nome");
    const payload = {
      name: form.name.trim(),
      whatsapp: form.whatsapp.trim() || null,
      pathology: form.pathology.trim() || null,
      birth_date: form.birth_date || null,
      referral_source: form.referral_source.trim() || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Pacientes</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar paciente..."
            className="w-60 rounded-lg border px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Inativos
          </label>
        </div>
      </div>

      {/* Quick create */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="flex-1">
          <label className="mb-1 text-xs font-bold text-muted-foreground">Nome *</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Nome do paciente"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="w-40">
          <label className="mb-1 text-xs font-bold text-muted-foreground">WhatsApp</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="(16) 99999-9999"
            value={form.whatsapp}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 text-xs font-bold text-muted-foreground">Patologia</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Diagnóstico / patologia"
            value={form.pathology}
            onChange={(e) => setForm((f) => ({ ...f, pathology: e.target.value }))}
          />
        </div>
        <div className="w-40">
          <label className="mb-1 text-xs font-bold text-muted-foreground">Nascimento</label>
          <input
            type="date"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={form.birth_date}
            onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
          />
        </div>
        <div className="w-40">
          <label className="mb-1 text-xs font-bold text-muted-foreground">Origem</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Indicação, Google..."
            value={form.referral_source}
            onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))}
          />
        </div>
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          onClick={handleSave}
        >
          {editing ? "Salvar" : "Adicionar"}
        </button>
        {editing && (
          <button
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={() => {
              setEditing(null);
setForm({ name: "", whatsapp: "", pathology: "", birth_date: "", referral_source: "" });
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Patient list */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-xl border bg-card p-4"
          >
            <div className="flex-1">
              <p className={`font-bold ${p.archived ? "text-muted-foreground line-through" : ""}`}>
                {p.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {p.whatsapp || "Sem WhatsApp"} · {p.pathology || "Sem patologia"}
                {p.birth_date && ` · Nasc: ${p.birth_date}`}
                {p.referral_source && ` · Origem: ${p.referral_source}`}
                {p.archived && " · Inativo"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => setChartPatient(p)}
              >
                Ficha
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => openEdit(p)}
              >
                Editar
              </button>
              <button
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  p.archived
                    ? "text-green-600 hover:bg-green-50"
                    : "text-orange-600 hover:bg-orange-50"
                }`}
                onClick={() =>
                  archiveMutation.mutate({ id: p.id, archived: !p.archived })
                }
              >
                {p.archived ? "Reativar" : "Inativar"}
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Remover ${p.name}?`)) deleteMutation.mutate(p.id);
                }}
              >
                Apagar
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum paciente encontrado.
          </p>
        )}
      </div>

      {chartPatient && (
        <PatientChartModal
          patient={chartPatient}
          onClose={() => setChartPatient(null)}
        />
      )}
    </div>
  );
}
