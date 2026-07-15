import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { fetchAnamnesis, upsertAnamnesis, fetchEvolutions, createEvolution, deleteEvolution } from "@/lib/supabase/queries/clinical";
import { fetchPatientPackages, createSessionPackage } from "@/lib/supabase/queries/services";
import { fetchServices } from "@/lib/supabase/queries/services";
import { todayIso, fmtDate } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Patient } from "@/lib/types/database";

interface PatientChartModalProps {
  patient: Patient;
  onClose: () => void;
}

export function PatientChartModal({ patient, onClose }: PatientChartModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("anamnesis");
  const [newPackageOpen, setNewPackageOpen] = useState(false);
  const [pkgTotal, setPkgTotal] = useState("10");
  const [pkgService, setPkgService] = useState("");

  const { data: anamnesis, refetch: refetchAnam } = useQuery({
    queryKey: ["anamnesis", patient.id],
    queryFn: () => fetchAnamnesis(patient.id),
  });

  const { data: evolutions = [], refetch: refetchEvo } = useQuery({
    queryKey: ["evolutions", patient.id],
    queryFn: () => fetchEvolutions(patient.id),
  });

  const { data: packages = [], refetch: refetchPkgs } = useQuery({
    queryKey: ["session_packages", patient.id],
    queryFn: () => fetchPatientPackages(patient.id),
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Parameters<typeof upsertAnamnesis>[0]) => upsertAnamnesis(data),
    onSuccess: () => {
      refetchAnam();
      toast.success("Anamnese salva");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const createPkgMutation = useMutation({
    mutationFn: () => createSessionPackage({
      patient_id: patient.id,
      service_id: pkgService || null,
      total_sessions: parseInt(pkgTotal) || 10,
      remaining_sessions: parseInt(pkgTotal) || 10,
    }),
    onSuccess: () => {
      refetchPkgs();
      queryClient.invalidateQueries({ queryKey: ["session_packages"] });
      toast.success("Pacote criado");
      setNewPackageOpen(false);
      setPkgTotal("10");
      setPkgService("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const anamnesisForm = useForm({
    defaultValues: {
      chief_complaint: "",
      history: "",
      diagnosis: "",
      limitations: "",
      goals: "",
      obs: "",
    },
  });

  useEffect(() => {
    if (anamnesis) {
      anamnesisForm.reset({
        chief_complaint: anamnesis.chief_complaint || "",
        history: anamnesis.history || "",
        diagnosis: anamnesis.diagnosis || "",
        limitations: anamnesis.limitations || "",
        goals: anamnesis.goals || "",
        obs: anamnesis.obs || "",
      });
    }
  }, [anamnesis, anamnesisForm]);

  function handleSaveAnamnesis() {
    const data = anamnesisForm.getValues();
    upsertMutation.mutate({
      patient_id: patient.id,
      chief_complaint: data.chief_complaint || null,
      history: data.history || null,
      diagnosis: data.diagnosis || null,
      limitations: data.limitations || null,
      goals: data.goals || null,
      obs: data.obs || null,
    });
  }

  const [evoDate, setEvoDate] = useState(todayIso());
  const [evoConduct, setEvoConduct] = useState("");
  const [evoGuidance, setEvoGuidance] = useState("");

  async function handleAddEvolution() {
    if (!evoConduct.trim()) return toast.warning("Informe a conduta");
    try {
      await createEvolution({
        patient_id: patient.id,
        date: evoDate || todayIso(),
        conduct: evoConduct.trim(),
        guidance: evoGuidance.trim() || null,
      });
      refetchEvo();
      setEvoConduct("");
      setEvoGuidance("");
      toast.success("Evolução registrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDeleteEvolution(id: string) {
    if (!confirm("Remover esta evolução?")) return;
    try {
      await deleteEvolution(id);
      refetchEvo();
      toast.success("Evolução removida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div>
            <DialogDescription>Ficha do paciente</DialogDescription>
            <DialogTitle>{patient.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {patient.whatsapp || "Sem WhatsApp"} · {patient.pathology || "Sem patologia"}
            </p>
          </div>
          <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Exportar PDF
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
            <TabsTrigger value="evolutions">Evoluções ({evolutions.length})</TabsTrigger>
            <TabsTrigger value="packages">Pacotes ({packages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="anamnesis">
            <div className="space-y-4">
              <div>
                <Label className="mb-1 block">Queixa principal</Label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  {...anamnesisForm.register("chief_complaint")}
                />
              </div>
              <div>
                <Label className="mb-1 block">História atual</Label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  {...anamnesisForm.register("history")}
                />
              </div>
              <div>
                <Label className="mb-1 block">Diagnóstico / hipótese</Label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  {...anamnesisForm.register("diagnosis")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Limitações funcionais</Label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    {...anamnesisForm.register("limitations")}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Objetivos</Label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    {...anamnesisForm.register("goals")}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Observações</Label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  {...anamnesisForm.register("obs")}
                />
              </div>
              <Button onClick={handleSaveAnamnesis}>
                Salvar anamnese
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="evolutions">
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-bold">Nova evolução</h4>
                <div className="mb-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Data</Label>
                  <input
                    type="date"
                    className="rounded-lg border px-3 py-2 text-sm"
                    value={evoDate}
                    onChange={(e) => setEvoDate(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Conduta *</Label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Descreva a conduta realizada..."
                    value={evoConduct}
                    onChange={(e) => setEvoConduct(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Orientações</Label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Orientações para o paciente..."
                    value={evoGuidance}
                    onChange={(e) => setEvoGuidance(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddEvolution}>
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {evolutions.map((evo) => (
                  <div key={evo.id} className="rounded-lg border p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold">
                        {evo.date ? fmtDate(evo.date) : "Sem data"}
                      </span>
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => handleDeleteEvolution(evo.id)}
                      >
                        Remover
                      </button>
                    </div>
                    <p className="text-sm">{evo.conduct || "Sem registro"}</p>
                    {evo.guidance && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-bold">Orientações:</span> {evo.guidance}
                      </p>
                    )}
                  </div>
                ))}
                {evolutions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma evolução registrada.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="packages">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Histórico de pacotes</h4>
                <Button size="sm" onClick={() => setNewPackageOpen(true)}>
                  Novo Pacote
                </Button>
              </div>

              {packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum pacote registrado para este paciente.
                </p>
              ) : (
                <div className="space-y-2">
                  {packages.map((pkg, index) => {
                    const remaining = pkg.remaining_sessions ?? 0;
                    const total = pkg.total_sessions ?? 0;
                    const used = total - remaining;
                    const pct = total > 0 ? (used / total) * 100 : 0;
                    const packageStatus = remaining === 0 ? "Concluído" : pkg.active ? "Em andamento" : "Encerrado";
                    return (
                      <div key={pkg.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">
                              <span className="mr-2 text-femic-navy">Pacote #{index + 1}</span>
                              {total} sessões
                              {pkg.service_id && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  · {services.find((s) => s.id === pkg.service_id)?.name || ""}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Criado em {pkg.created_at ? fmtDate(pkg.created_at) : "—"}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            remaining === 0 || !pkg.active
                              ? "bg-gray-100 text-gray-600"
                              : remaining <= 3
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {packageStatus} · {remaining} restantes
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 100 ? "bg-gray-400" : pct >= 70 ? "bg-red-400" : "bg-green-400"
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {used} de {total} utilizadas
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Dialog Novo Pacote */}
      <Dialog open={newPackageOpen} onOpenChange={(open) => !open && setNewPackageOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div>
              <DialogDescription>Novo pacote</DialogDescription>
              <DialogTitle>{patient.name}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Número de sessões</Label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  value={pkgTotal}
                  onChange={(e) => setPkgTotal(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Serviço (opcional)</Label>
                <select
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  value={pkgService}
                  onChange={(e) => setPkgService(e.target.value)}
                >
                  <option value="">Todos / Geral</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPackageOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createPkgMutation.mutate()}
              disabled={createPkgMutation.isPending || parseInt(pkgTotal) < 1}
            >
              {createPkgMutation.isPending ? "Criando..." : "Criar Pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
