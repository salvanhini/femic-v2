import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchServices } from "@/lib/supabase/queries/services";
import { closeSessionPackage, createSessionPackage, fetchFuturePackageAppointments, fetchSessionPackages } from "@/lib/supabase/queries/services";
import { todayIso, fmtDate, fmtTime } from "@/lib/utils/date";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const [closingPackage, setClosingPackage] = useState<SessionPackage | null>(null);
  const [closureReason, setClosureReason] = useState("");
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<Set<string>>(new Set());
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
      const { error } = await getSupabase().from("session_packages").update(data as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      toast.success("Pacote atualizado");
      resetForm();
    },
  });

  const { data: futureAppointments = [] } = useQuery({
    queryKey: ["future_package_appointments", closingPackage?.id],
    queryFn: () => fetchFuturePackageAppointments(closingPackage!, todayIso()),
    enabled: !!closingPackage,
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      if (!closingPackage) throw new Error("Pacote não encontrado");
      return closeSessionPackage(closingPackage, closureReason, [...appointmentsToCancel]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Pacote encerrado");
      setClosingPackage(null);
      setClosureReason("");
      setAppointmentsToCancel(new Set());
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível encerrar o pacote"),
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

  function openClosePackage(pkg: SessionPackage) {
    setClosingPackage(pkg);
    setClosureReason("");
    setAppointmentsToCancel(new Set());
  }

  function toggleAppointmentToCancel(id: string) {
    setAppointmentsToCancel((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                  {pkg.closure_reason && ` · Motivo: ${pkg.closure_reason}`}
                </p>
              </div>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => handleEdit(pkg)}
              >
                Editar
              </button>
              {pkg.active && (
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
                  onClick={() => openClosePackage(pkg)}
                >
                  Encerrar
                </button>
              )}
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

      <Dialog open={!!closingPackage} onOpenChange={(open) => !open && setClosingPackage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div>
              <DialogDescription>Encerramento antecipado</DialogDescription>
              <DialogTitle>{closingPackage ? patientMap.get(closingPackage.patient_id)?.name || "Paciente" : ""}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            {closingPackage && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Saldo que permanecerá no histórico: <strong>{closingPackage.remaining_sessions ?? 0} sessão(ões)</strong>.</p>
                <div>
                  <label className="mb-1 block text-sm font-bold">Motivo do encerramento (opcional)</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} maxLength={300} placeholder="Ex.: paciente recebeu alta, mudou de cidade ou interrompeu o tratamento." value={closureReason} onChange={(event) => setClosureReason(event.target.value)} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold">Sessões futuras</p>
                  {futureAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Não há sessões futuras para este pacote.</p>
                  ) : futureAppointments.map((appointment) => (
                    <label key={appointment.id} className="mb-2 flex cursor-pointer gap-3 rounded-lg border p-3 text-sm">
                      <input type="checkbox" checked={appointmentsToCancel.has(appointment.id)} onChange={() => toggleAppointmentToCancel(appointment.id)} />
                      <span>Cancelar {fmtDate(appointment.appointment_date)} às {fmtTime(appointment.start_time)}</span>
                    </label>
                  ))}
                  {futureAppointments.length > 0 && <p className="mt-2 text-xs text-muted-foreground">As sessões começam desmarcadas; selecione somente as que devem ser canceladas.</p>}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingPackage(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>{closeMutation.isPending ? "Encerrando..." : "Encerrar pacote"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
