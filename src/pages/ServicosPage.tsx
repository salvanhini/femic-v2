import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchServices, fetchHealthInsurances } from "@/lib/supabase/queries/services";
import type { Service } from "@/lib/types/database";

export default function ServicosPage() {
  const queryClient = useQueryClient();
  const { data: services = [] } = useServices();
  const { data: payers = [] } = useHealthInsurances();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "", duration: "45", mode: "individual", max_patients: "4", payer: "" });

  const payerMap = useMemo(() => new Map(payers.map((p) => [p.id, p])), [payers]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Service>) => {
      const { error } = await getSupabase().from("services").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Serviço criado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      const { error } = await getSupabase().from("services").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Serviço atualizado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  function handleEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      price: String(service.price || ""),
      duration: String(service.duration_minutes || 45),
      mode: service.appointment_mode || "individual",
      max_patients: String(service.max_patients || 4),
      payer: service.health_insurance_id || "",
    });
  }

  function handleCancel() {
    setEditingId(null);
    setForm({ name: "", price: "", duration: "45", mode: "individual", max_patients: "4", payer: "" });
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.warning("Informe o nome do serviço");
    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      duration_minutes: Number(form.duration) || 45,
      appointment_mode: form.mode,
      max_patients: Number(form.max_patients) || 4,
      health_insurance_id: form.payer || null,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    handleCancel();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Serviços</h2>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <input
            placeholder="Nome do serviço"
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Valor"
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.mode}
            onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
          >
            <option value="individual">Individual</option>
            <option value="grupo">Grupo</option>
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={form.payer}
            onChange={(e) => setForm((f) => ({ ...f, payer: e.target.value }))}
          >
            <option value="">Sem convênio</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            onClick={handleSave}
          >
            {editingId ? "Atualizar" : "Adicionar"}
          </button>
          {editingId && (
            <button className="rounded-lg border px-4 py-2 text-sm" onClick={handleCancel}>
              Cancelar
            </button>
          )}
        </div>
      </div>

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
