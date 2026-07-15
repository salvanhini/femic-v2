import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchServices, fetchHealthInsurances } from "@/lib/supabase/queries/services";
import type { Service } from "@/lib/types/database";

const serviceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.preprocess((v) => Number(v) || 0, z.number().min(0)),
  duration_minutes: z.preprocess((v) => Number(v) || 45, z.number().min(5, "Mínimo 5min").max(480, "Máximo 8h")),
  appointment_mode: z.enum(["individual", "grupo"]),
  max_patients: z.preprocess((v) => Number(v) || 4, z.number().min(1).max(50)),
  health_insurance_id: z.string().nullable(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function ServicosPage() {
  const queryClient = useQueryClient();
  const { data: services = [] } = useServices();
  const { data: payers = [] } = useHealthInsurances();

  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      price: 0,
      duration_minutes: 45,
      appointment_mode: "individual",
      max_patients: 4,
      health_insurance_id: null,
    },
  });

  const payerMap = useMemo(() => new Map(payers.map((p) => [p.id, p])), [payers]);

  useEffect(() => {
    if (editingId) {
      const service = services.find((s) => s.id === editingId);
      if (service) {
        form.reset({
          name: service.name,
          price: service.price ?? 0,
          duration_minutes: service.duration_minutes ?? 45,
          appointment_mode: (service.appointment_mode as "individual" | "grupo") || "individual",
          max_patients: service.max_patients ?? 4,
          health_insurance_id: service.health_insurance_id,
        });
      }
    }
  }, [editingId, services, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const { error } = await getSupabase().from("services").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Serviço criado");
      form.reset();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ServiceFormData }) => {
      const { error } = await getSupabase().from("services").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Serviço atualizado");
      handleCancel();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  function handleEdit(service: Service) {
    setEditingId(service.id);
  }

  function handleCancel() {
    setEditingId(null);
    form.reset();
  }

  function handleSave(data: ServiceFormData) {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Serviços</h2>

      <form onSubmit={form.handleSubmit(handleSave)} className="rounded-xl border bg-card p-4">
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <input
              placeholder="Nome do serviço"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <input
              type="number"
              step="0.01"
              placeholder="Valor (R$)"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("price")}
            />
          </div>
          <div>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("appointment_mode")}
            >
              <option value="individual">Individual</option>
              <option value="grupo">Grupo</option>
            </select>
          </div>
          <div>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("health_insurance_id")}
            >
              <option value="">Sem convênio</option>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Duração (min)</label>
            <input
              type="number"
              min="5"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("duration_minutes")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Máx. pacientes</label>
            <input
              type="number"
              min="1"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...form.register("max_patients")}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {editingId ? "Atualizar" : "Adicionar"}
          </button>
          {editingId && (
            <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={handleCancel}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <div className="flex-1">
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                R$ {Number(s.price || 0).toFixed(2)} ·{" "}
                {s.appointment_mode === "grupo" ? `Grupo (máx ${s.max_patients})` : "Individual"} ·{" "}
                {s.duration_minutes}min
                {s.health_insurance_id && (
                  <> · {payerMap.get(s.health_insurance_id)?.name || "Convênio"}</>
                )}
              </p>
            </div>
            <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent" onClick={() => handleEdit(s)}>
              Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 1000 * 60 * 5,
  });
}

function useHealthInsurances() {
  return useQuery({
    queryKey: ["health_insurances"],
    queryFn: fetchHealthInsurances,
    staleTime: 1000 * 60 * 5,
  });
}
