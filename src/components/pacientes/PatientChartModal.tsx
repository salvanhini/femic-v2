import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAnamnesis, upsertAnamnesis, fetchEvolutions, createEvolution, deleteEvolution } from "@/lib/supabase/queries/clinical";
import { todayIso, fmtDate } from "@/lib/utils/date";
import type { Patient, ClinicalAnamnesis } from "@/lib/types/database";

interface PatientChartModalProps {
  patient: Patient;
  onClose: () => void;
}

export function PatientChartModal({ patient, onClose }: PatientChartModalProps) {
  const [tab, setTab] = useState<"anamnesis" | "evolutions">("anamnesis");

  const { data: anamnesis, refetch: refetchAnam } = useQuery({
    queryKey: ["anamnesis", patient.id],
    queryFn: () => fetchAnamnesis(patient.id),
  });

  const { data: evolutions = [], refetch: refetchEvo } = useQuery({
    queryKey: ["evolutions", patient.id],
    queryFn: () => fetchEvolutions(patient.id),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<ClinicalAnamnesis>) => upsertAnamnesis(data),
    onSuccess: () => {
      refetchAnam();
      toast.success("Anamnese salva");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [history, setHistory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [limitations, setLimitations] = useState("");
  const [goals, setGoals] = useState("");
  const [obs, setObs] = useState("");

  const [evoDate, setEvoDate] = useState(todayIso());
  const [evoConduct, setEvoConduct] = useState("");
  const [evoGuidance, setEvoGuidance] = useState("");

  useEffect(() => {
    if (anamnesis) {
      setChiefComplaint(anamnesis.chief_complaint || "");
      setHistory(anamnesis.history || "");
      setDiagnosis(anamnesis.diagnosis || "");
      setLimitations(anamnesis.limitations || "");
      setGoals(anamnesis.goals || "");
      setObs(anamnesis.obs || "");
    } else {
      setChiefComplaint("");
      setHistory("");
      setDiagnosis("");
      setLimitations("");
      setGoals("");
      setObs("");
    }
  }, [anamnesis]);

  function handleSaveAnamnesis() {
    upsertMutation.mutate({
      patient_id: patient.id,
      chief_complaint: chiefComplaint || null,
      history: history || null,
      diagnosis: diagnosis || null,
      limitations: limitations || null,
      goals: goals || null,
      obs: obs || null,
    });
  }

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Ficha do paciente</p>
            <h3 className="text-lg font-bold">{patient.name}</h3>
            <p className="text-sm text-muted-foreground">
              {patient.whatsapp || "Sem WhatsApp"} · {patient.pathology || "Sem patologia"}
            </p>
          </div>
          <button className="rounded-lg p-2 hover:bg-accent" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-6 pt-4">
          <button
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === "anamnesis" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
            onClick={() => setTab("anamnesis")}
          >
            Anamnese
          </button>
          <button
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === "evolutions" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
            onClick={() => setTab("evolutions")}
          >
            Evoluções ({evolutions.length})
          </button>
        </div>

        <div className="p-6">
          {tab === "anamnesis" ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold">Queixa principal</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">História atual</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">Diagnóstico / hipótese</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold">Limitações funcionais</label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    value={limitations}
                    onChange={(e) => setLimitations(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Objetivos</label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">Observações</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>
              <button
                className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground"
                onClick={handleSaveAnamnesis}
              >
                Salvar anamnese
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* New evolution form */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-bold">Nova evolução</h4>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Data</label>
                  <input
                    type="date"
                    className="rounded-lg border px-3 py-2 text-sm"
                    value={evoDate}
                    onChange={(e) => setEvoDate(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Conduta *</label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Descreva a conduta realizada..."
                    value={evoConduct}
                    onChange={(e) => setEvoConduct(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Orientações</label>
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Orientações para o paciente..."
                    value={evoGuidance}
                    onChange={(e) => setEvoGuidance(e.target.value)}
                  />
                </div>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  onClick={handleAddEvolution}
                >
                  Adicionar
                </button>
              </div>

              {/* Evolution list */}
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
          )}
        </div>
      </div>
    </div>
  );
}
