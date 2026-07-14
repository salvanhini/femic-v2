import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchTasks, updateTask, deleteTask } from "@/lib/supabase/queries/assistants";
import { fmtDate, relativeTime } from "@/lib/utils/date";
import type { AssistantTask } from "@/lib/types/database";

type StatusFilter = "all" | "pending" | "completed" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 bg-red-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-green-600 bg-green-50",
};

export default function AssistentePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["assistant_tasks", filter],
    queryFn: () => fetchTasks(filter !== "all" ? { status: filter } : undefined),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTask(id, { status: "completed", completed_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant_tasks"] });
      toast.success("Tarefa concluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => updateTask(id, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant_tasks"] });
      toast.success("Tarefa cancelada");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant_tasks"] });
      toast.success("Tarefa removida");
    },
  });

  const filtered = tasks.filter((t) =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.patient_name?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    cancelled: tasks.filter((t) => t.status === "cancelled").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Assistente IA</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="w-56 rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {(["all", "pending", "completed", "cancelled"] as const).map((f) => (
          <button
            key={f}
            className={`rounded-xl border bg-card p-4 text-left transition-colors ${
              filter === f ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setFilter(f)}
          >
            <p className="text-2xl font-bold">
              {f === "all" ? tasks.length : counts[f]}
            </p>
            <p className="text-sm text-muted-foreground">
              {f === "all" ? "Total" : STATUS_LABELS[f]}
            </p>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhuma tarefa encontrada.</p>
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => completeMutation.mutate(task.id)}
              onCancel={() => {
                if (confirm("Cancelar esta tarefa?")) cancelMutation.mutate(task.id);
              }}
              onDelete={() => {
                if (confirm("Remover esta tarefa permanentemente?")) deleteMutation.mutate(task.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onCancel,
  onDelete,
}: {
  task: AssistantTask;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === "completed" || task.status === "cancelled";

  return (
    <div className={`rounded-xl border bg-card p-4 ${isDone ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${PRIORITY_COLORS[task.priority || "medium"] || "bg-muted text-muted-foreground"}`}>
              {task.priority || "normal"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {task.type || "geral"}
            </span>
            <span className="text-xs text-muted-foreground">
              {relativeTime(task.created_at)}
            </span>
          </div>

          <p className={`font-bold ${task.status === "cancelled" ? "line-through" : ""}`}>
            {task.title}
          </p>

          {task.patient_name && (
            <p className="text-sm text-muted-foreground">
              Paciente: {task.patient_name}
              {task.service_name && ` · ${task.service_name}`}
            </p>
          )}

          {task.suggestion_reason && (
            <p className="mt-1 text-sm text-muted-foreground">{task.suggestion_reason}</p>
          )}

          {task.notes && (
            <p className="mt-1 text-sm italic text-muted-foreground">"{task.notes}"</p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          {task.status === "pending" && (
            <>
              <button
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                onClick={onComplete}
              >
                Concluir
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent"
                onClick={onCancel}
              >
                Cancelar
              </button>
            </>
          )}
          <button
            className="rounded-lg border px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            onClick={onDelete}
          >
            Remover
          </button>
        </div>
      </div>

      {task.suggested_slots && Array.isArray(task.suggested_slots) && task.suggested_slots.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(task.suggested_slots as Array<{ date?: string; start_time?: string; end_time?: string }>).map((slot, i) => (
            <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {slot.date && fmtDate(slot.date)} {slot.start_time?.slice(0, 5) || ""}-{slot.end_time?.slice(0, 5) || ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
