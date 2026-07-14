import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchServices } from "@/lib/supabase/queries/services";
import { fetchSessionPackages } from "@/lib/supabase/queries/services";
import type { SessionPackage } from "@/lib/types/database";

export default function PacotesPage() {
  const queryClient = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: packages = [] } = useQuery({ queryKey: ["session_packages"], queryFn: fetchSessionPackages });

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const [patientId, setPatientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [totalSessions, setTotalSessions] = useState("12");
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<SessionPackage>) => {
      const { error } = await getSupabase().from("session_packages").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      toast.success("Pacote criado");
      resetForm();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SessionPackage> }) => {
      const { error } = await getSupabase().from("session_packages").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      toast.success("Pacote atualizado");
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("session_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      toast.success("Pacote removido");
    },
  });

  function resetForm() {
    setPatientId("");
    setServiceId("");
    setTotalSessions("12");
    setEditingId(null);
  }

  function handleEdit(pkg: SessionPackage) {
    setEditingId(pkg.id);
    setPatientId(pkg.patient_id);
    setServiceId(pkg.service_id || "");
    setTotalSessions(String(pkg.total_sessions || 0));
  }

  function handleSave() {
    if (!patientId) return toast.warning("Selecione o paciente");
    if (!serviceId) return toast.warning("Selecione o serviço");
    const payload = {
      patient_id: patientId,
      service_id: serviceId,
      total_sessions: Number(totalSessions) || 0,
      remaining_sessions: Number(totalSessions) || 0,
      active: true,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Pacotes de Sessão</h2>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Paciente *</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Serviço *</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Total de sessões</label>
            <input
              type="number"
              min="1"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              onClick={handleSave}
            >
              {editingId ? "Atualizar" : "Adicionar"}
            </button>
            {editingId && (
              <button className="rounded-lg border px-4 py-2 text-sm" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {packages.map((pkg) => {
          const patient = patientMap.get(pkg.patient_id);
          const service = serviceMap.get(pkg.service_id || "");
          const used = (pkg.total_sessions || 0) - (pkg.remaining_sessions || 0);
          const low = (pkg.remaining_sessions || 0) <= 3;

          return (
            <div key={pkg.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="flex-1">
                <p className="font-bold">{patient?.name || "Paciente"}</p>
                <p className="text-sm text-muted-foreground">
                  {service?.name || "Serviço"} · {used}/{pkg.total_sessions} sessões usadas ·{" "}
                  <span className={low ? "font-bold text-red-500" : ""}>
                    saldo {pkg.remaining_sessions}
                  </span>
                  {!pkg.active && " · Inativo"}
                </p>
              </div>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => handleEdit(pkg)}
              >
                Editar
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm("Remover este pacote?")) deleteMutation.mutate(pkg.id);
                }}
              >
                Remover
              </button>
            </div>
          );
        })}
        {packages.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">Nenhum pacote cadastrado.</p>
        )}
      </div>
    </div>
  );
}
