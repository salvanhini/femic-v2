import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchServices } from "@/lib/supabase/queries/services";
import { fetchSessionPackages } from "@/lib/supabase/queries/services";
import type { SessionPackage } from "@/lib/types/database";

const packageSchema = z.object({
  patient_id: z.string().min(1, "Selecione o paciente"),
  service_id: z.string().min(1, "Selecione o serviço"),
  total_sessions: z.preprocess((v) => Number(v) || 0, z.number().min(1, "Mínimo 1 sessão").max(999)),
});

type PackageFormData = z.infer<typeof packageSchema>;

export default function PacotesPage() {
  const queryClient = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: packages = [] } = useQuery({ queryKey: ["session_packages"], queryFn: fetchSessionPackages });

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      patient_id: "",
      service_id: "",
      total_sessions: 12,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const { error } = await getSupabase().from("session_packages").insert({
        ...data,
        remaining_sessions: data.total_sessions,
        active: true,
      });
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
    setEditingId(null);
    form.reset({ patient_id: "", service_id: "", total_sessions: 12 });
  }

  function handleEdit(pkg: SessionPackage) {
    setEditingId(pkg.id);
    form.reset({
      patient_id: pkg.patient_id,
      service_id: pkg.service_id || "",
      total_sessions: pkg.total_sessions || 0,
    });
  }

  function handleSave(data: PackageFormData) {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          patient_id: data.patient_id,
          service_id: data.service_id,
          total_sessions: data.total_sessions,
          remaining_sessions: data.total_sessions - ((packages.find((p) => p.id === editingId)?.total_sessions ?? data.total_sessions) - (packages.find((p) => p.id === editingId)?.remaining_sessions ?? 0)),
        },
      });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Pacotes de Sessão</h2>

      <form onSubmit={form.handleSubmit(handleSave)} className="rounded-xl border bg-card p-4">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Paciente *</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("patient_id")}
            >
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {form.formState.errors.patient_id && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.patient_id.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Serviço *</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("service_id")}
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {form.formState.errors.service_id && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.service_id.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Total de sessões</label>
            <input
              type="number"
              min="1"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("total_sessions")}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              {editingId ? "Atualizar" : "Adicionar"}
            </button>
            {editingId && (
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

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
