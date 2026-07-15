import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchServices } from "@/lib/supabase/queries/services";
import { createSessionPackage, fetchSessionPackages } from "@/lib/supabase/queries/services";
import type { SessionPackage } from "@/lib/types/database";

const packageSchema = z.object({
  patient_id: z.string().min(1, "Selecione o paciente"),
  service_id: z.string(),
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
  const packageNumberById = useMemo(() => {
    const byPatient = new Map<string, SessionPackage[]>();
    packages.forEach((pkg) => {
      const patientPackages = byPatient.get(pkg.patient_id) || [];
      patientPackages.push(pkg);
      byPatient.set(pkg.patient_id, patientPackages);
    });

    const numbers = new Map<string, number>();
    byPatient.forEach((patientPackages) => {
      patientPackages
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach((pkg, index) => numbers.set(pkg.id, index + 1));
    });
    return numbers;
  }, [packages]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const filteredPackages = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return packages;

    return packages.filter((pkg) => {
      const patientName = patientMap.get(pkg.patient_id)?.name || "";
      const serviceName = serviceMap.get(pkg.service_id || "")?.name || "";
      return patientName.toLocaleLowerCase("pt-BR").includes(term)
        || serviceName.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [packages, patientMap, search, serviceMap]);

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
      await createSessionPackage({
        patient_id: data.patient_id,
        service_id: data.service_id || null,
        total_sessions: data.total_sessions,
        remaining_sessions: data.total_sessions,
      });
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
      const { error } = await (getSupabase() as any).from("session_packages").update(data).eq("id", id);
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
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    toast.info(`Editando pacote #${packageNumberById.get(pkg.id) || 1}`);
  }

  function handleSave(data: PackageFormData) {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          patient_id: data.patient_id,
          service_id: data.service_id || null,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Pacotes de Sessão</h2>
          <p className="text-sm text-muted-foreground">Consulte o histórico e o saldo de cada paciente.</p>
        </div>
        <div className="w-full sm:w-80">
          <label htmlFor="package-search" className="mb-1 block text-xs font-bold text-muted-foreground">Buscar pacotes</label>
          <input
            id="package-search"
            type="search"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Paciente ou serviço..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <form ref={formRef} onSubmit={form.handleSubmit(handleSave)} className="rounded-xl border bg-card p-4">
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
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Serviço</label>
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
        {filteredPackages.map((pkg) => {
          const patient = patientMap.get(pkg.patient_id);
          const service = serviceMap.get(pkg.service_id || "");
          const used = (pkg.total_sessions || 0) - (pkg.remaining_sessions || 0);
          const low = (pkg.remaining_sessions || 0) <= 3;

          return (
            <div key={pkg.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="flex-1">
                <p className="font-bold">{patient?.name || "Paciente"} <span className="text-sm text-femic-navy">· Pacote #{packageNumberById.get(pkg.id) || 1}</span></p>
                <p className="text-sm text-muted-foreground">
                  {service?.name || "Serviço"} · {used}/{pkg.total_sessions} sessões usadas ·{" "}
                  <span className={low ? "font-bold text-red-500" : ""}>
                    saldo {pkg.remaining_sessions}
                  </span>
                  {pkg.remaining_sessions === 0 ? " · Concluído" : !pkg.active ? " · Encerrado" : " · Em andamento"}
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
        {packages.length > 0 && filteredPackages.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">Nenhum pacote encontrado para esta busca.</p>
        )}
      </div>
    </div>
  );
}
