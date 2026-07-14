import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchHealthInsurances } from "@/lib/supabase/queries/services";
import type { HealthInsurance } from "@/lib/types/database";

export default function ConveniosPage() {
  const queryClient = useQueryClient();
  const { data: payers = [] } = useQuery({
    queryKey: ["health_insurances"],
    queryFn: fetchHealthInsurances,
  });

  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await getSupabase().from("health_insurances").insert({ name, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health_insurances"] });
      toast.success("Convênio salvo");
      setName("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await getSupabase()
        .from("health_insurances")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health_insurances"] });
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Convênios</h2>

      <div className="flex gap-2">
        <input
          placeholder="Nome do convênio"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createMutation.mutate(name)}
        />
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          onClick={() => createMutation.mutate(name)}
          disabled={!name.trim()}
        >
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {payers.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-xl border bg-card p-4"
          >
            <div className="flex-1">
              <p className={p.active ? "font-bold" : "font-bold text-muted-foreground line-through"}>
                {p.name}
              </p>
            </div>
            <button
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                p.active ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"
              }`}
              onClick={() => toggleMutation.mutate({ id: p.id, active: !p.active })}
            >
              {p.active ? "Inativar" : "Ativar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
