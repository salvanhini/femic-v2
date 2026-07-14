import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchAnamnesis, upsertAnamnesis, fetchEvolutions, createEvolution, deleteEvolution } from "@/lib/supabase/queries/clinical";
import { fetchDocuments } from "@/lib/supabase/queries/assistants";
import { todayIso, fmtDate } from "@/lib/utils/date";
import type { ClinicalAnamnesis } from "@/lib/types/database";

export default function ProntuarioPage() {
  const queryClient = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const activePatients = useMemo(() => patients.filter((p) => !p.archived), [patients]);

  const [patientId, setPatientId] = useState("");
  const [tab, setTab] = useState<"anamnesis" | "evolutions" | "documents">("anamnesis");

  const { data: anamnesis, refetch: refetchAnam } = useQuery({
    queryKey: ["anamnesis", patientId],
    queryFn: () => fetchAnamnesis(patientId),
    enabled: !!patientId,
  });

  const { data: evolutions = [], refetch: refetchEvo } = useQuery({
    queryKey: ["evolutions", patientId],
    queryFn: () => fetchEvolutions(patientId),
    enabled: !!patientId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", patientId],
    queryFn: () => fetchDocuments(patientId),
    enabled: !!patientId,
  });

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

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

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<ClinicalAnamnesis>) => upsertAnamnesis(data),
    onSuccess: () => {
      refetchAnam();
      toast.success("Anamnese salva");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  function handleSaveAnamnesis() {
    if (!patientId) return toast.warning("Selecione um paciente");
    upsertMutation.mutate({
      patient_id: patientId,
      chief_complaint: chiefComplaint || null,
      history: history || null,
      diagnosis: diagnosis || null,
      limitations: limitations || null,
      goals: goals || null,
      obs: obs || null,
    });
  }

  async function handleAddEvolution() {
    if (!patientId) return toast.warning("Selecione um paciente");
    if (!evoConduct.trim()) return toast.warning("Informe a conduta");
    try {
      await createEvolution({
        patient_id: patientId,
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold">Prontuário Clínico</h2>
        <div className="w-72">
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Selecione um paciente...</option>
            {activePatients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {patient && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{patient.whatsapp || "Sem WhatsApp"}</span>
            <span>{patient.pathology || "Sem patologia"}</span>
            <span>{evolutions.length} evoluções</span>
          </div>
        )}
      </div>

      {!patientId ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          Selecione um paciente para visualizar o prontuário.
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b">
            {(["anamnesis", "evolutions", "documents"] as const).map((t) => (
              <button
                key={t}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setTab(t)}
              >
                {t === "anamnesis" ? "Anamnese" : t === "evolutions" ? `Evoluções (${evolutions.length})` : `Documentos (${documents.length})`}
              </button>
            ))}
          </div>

          {tab === "anamnesis" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold">Queixa principal</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">História atual</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={history} onChange={(e) => setHistory(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Diagnóstico / hipótese</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold">Limitações funcionais</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={limitations} onChange={(e) => setLimitations(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Objetivos</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Observações</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
                <button className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground" onClick={handleSaveAnamnesis}>
                  Salvar anamnese
                </button>
              </div>
            </div>
          )}

          {tab === "evolutions" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <h4 className="mb-3 text-sm font-bold">Nova evolução</h4>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Data</label>
                  <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={evoDate} onChange={(e) => setEvoDate(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Conduta *</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Descreva a conduta realizada..." value={evoConduct} onChange={(e) => setEvoConduct(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Orientações</label>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Orientações para o paciente..." value={evoGuidance} onChange={(e) => setEvoGuidance(e.target.value)} />
                </div>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" onClick={handleAddEvolution}>
                  Adicionar
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-muted-foreground">Linha do cuidado</h4>
                {evolutions.slice(0, 10).map((evo) => (
                  <div key={evo.id} className="rounded-lg border bg-card p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold">{evo.date ? fmtDate(evo.date) : "Sem data"}</span>
                      <button className="text-xs text-red-500 hover:underline" onClick={() => handleDeleteEvolution(evo.id)}>Remover</button>
                    </div>
                    <p className="text-sm">{evo.conduct || "Sem registro"}</p>
                    {evo.guidance && (
                      <p className="mt-1 text-sm text-muted-foreground"><span className="font-bold">Orientações:</span> {evo.guidance}</p>
                    )}
                  </div>
                ))}
                {evolutions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma evolução registrada.</p>
                )}
              </div>
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento gerado para este paciente.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{doc.document_title || doc.document_type || "Documento"}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.document_type} · {doc.document_date ? fmtDate(doc.document_date) : ""} · {doc.status}
                        </p>
                      </div>
                    </div>
                    {doc.rendered_html && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded bg-muted p-3 text-sm" dangerouslySetInnerHTML={{ __html: doc.rendered_html }} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
