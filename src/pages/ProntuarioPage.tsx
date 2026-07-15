import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchAnamnesis, upsertAnamnesis, fetchEvolutions, createEvolution, deleteEvolution } from "@/lib/supabase/queries/clinical";
import { fetchDocuments, createDocument } from "@/lib/supabase/queries/assistants";
import { todayIso, fmtDate } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { organizeClinicalDraft, type ClinicalAiFields } from "@/lib/ai/clinical-ai";

type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
import type { ClinicalAnamnesis } from "@/lib/types/database";

export default function ProntuarioPage() {
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const activePatients = useMemo(() => patients.filter((p) => !p.archived), [patients]);

  const [patientId, setPatientId] = useState("");
  const [tab, setTab] = useState<"anamnesis" | "evolutions" | "documents">("anamnesis");
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", type: "relatorio", body: "", html: "" });

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

  const { data: documents = [], refetch: refetchDocs } = useQuery({
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
  const [occupationRoutine, setOccupationRoutine] = useState("");
  const [physicalActivity, setPhysicalActivity] = useState("");
  const [redFlags, setRedFlags] = useState("");
  const [previousTreatments, setPreviousTreatments] = useState("");
  const [psychosocialFactors, setPsychosocialFactors] = useState("");
  const [fearAvoidance, setFearAvoidance] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [showComplement, setShowComplement] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [aiPreview, setAiPreview] = useState<ClinicalAiFields | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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
      setOccupationRoutine(anamnesis.occupation_routine || "");
      setPhysicalActivity(anamnesis.physical_activity_context || "");
      setRedFlags(anamnesis.red_flags || "");
      setPreviousTreatments(anamnesis.previous_treatments || "");
      setPsychosocialFactors(anamnesis.psychosocial_factors || "");
      setFearAvoidance(anamnesis.fear_avoidance || "");
      setClinicalSummary(anamnesis.clinical_summary || "");
    } else {
      setChiefComplaint(""); setHistory(""); setDiagnosis(""); setLimitations("");
      setGoals(""); setObs(""); setOccupationRoutine(""); setPhysicalActivity("");
      setRedFlags(""); setPreviousTreatments(""); setPsychosocialFactors("");
      setFearAvoidance(""); setClinicalSummary("");
    }
  }, [anamnesis]);

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<ClinicalAnamnesis>) => upsertAnamnesis(data),
    onSuccess: () => { refetchAnam(); toast.success("Anamnese salva"); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const organizeMutation = useMutation({
    mutationFn: () => organizeClinicalDraft(aiDraft),
    onSuccess: (fields) => setAiPreview(fields),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível organizar o rascunho"),
  });

  const fieldSetters: Record<keyof ClinicalAiFields, (value: string) => void> = {
    chief_complaint: setChiefComplaint, history: setHistory, diagnosis: setDiagnosis, limitations: setLimitations,
    goals: setGoals, obs: setObs, occupation_routine: setOccupationRoutine, physical_activity_context: setPhysicalActivity,
    red_flags: setRedFlags, previous_treatments: setPreviousTreatments, psychosocial_factors: setPsychosocialFactors,
    fear_avoidance: setFearAvoidance, clinical_summary: setClinicalSummary,
  };

  function applyAiFields() {
    if (!aiPreview) return;
    for (const [field, value] of Object.entries(aiPreview) as [keyof ClinicalAiFields, string][]) {
      if (value) fieldSetters[field](value);
    }
    setAiPreview(null);
    toast.success("Sugestões aplicadas. Revise antes de salvar.");
  }

  function startDictation() {
    const browserWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) return toast.warning("Ditado não está disponível neste navegador. Use Chrome ou digite o rascunho.");
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (!transcript) return;
      setAiDraft((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onerror = () => toast.error("Não foi possível transcrever o áudio. Tente novamente ou digite o texto.");
    recognition.onend = () => setIsRecording(false);
    setIsRecording(true);
    recognition.start();
  }

  const createDocMutation = useMutation({
    mutationFn: () => createDocument({
      patient_id: patientId || null,
      patient_name: patient?.name || null,
      document_title: docForm.title.trim() || null,
      document_type: docForm.type || null,
      document_body: docForm.body.trim() || null,
      rendered_html: docForm.html.trim() || null,
      document_date: todayIso(),
      status: "generated",
      source: "manual",
      metadata: {},
    }),
    onSuccess: () => {
      refetchDocs();
      toast.success("Documento gerado");
      setDocModalOpen(false);
      setDocForm({ title: "", type: "relatorio", body: "", html: "" });
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
      occupation_routine: occupationRoutine || null,
      physical_activity_context: physicalActivity || null,
      red_flags: redFlags || null,
      previous_treatments: previousTreatments || null,
      psychosocial_factors: psychosocialFactors || null,
      fear_avoidance: fearAvoidance || null,
      clinical_summary: clinicalSummary || null,
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
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
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
              <button key={t} className={`rounded-t-lg px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab(t)}>
                {t === "anamnesis" ? "Anamnese" : t === "evolutions" ? `Evoluções (${evolutions.length})` : `Documentos (${documents.length})`}
              </button>
            ))}
          </div>

          {tab === "anamnesis" && (
            <div className="space-y-5">
              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">Assistente de preenchimento</h3><p className="text-xs text-muted-foreground">Organiza o seu relato; revise tudo antes de salvar.</p></div><Button type="button" variant="outline" size="sm" onClick={startDictation}>{isRecording ? "Ouvindo..." : "Ditado por áudio"}</Button></div>
                <textarea className="w-full rounded-lg border bg-card px-3 py-2 text-sm" rows={4} value={aiDraft} onChange={(event) => setAiDraft(event.target.value)} placeholder="Digite ou dite o resumo do atendimento, queixa e achados..." />
                <div className="mt-2 flex justify-end"><Button type="button" size="sm" onClick={() => organizeMutation.mutate()} disabled={organizeMutation.isPending || aiDraft.trim().length < 10}>{organizeMutation.isPending ? "Organizando..." : "Organizar com IA"}</Button></div>
                {aiPreview && <div className="mt-3 rounded-lg border bg-card p-3"><p className="mb-2 text-sm font-bold">Prévia da IA</p><div className="space-y-2 text-sm">{Object.entries(aiPreview).filter(([, value]) => value).map(([field, value]) => <p key={field}><strong>{field.split("_").join(" ")}:</strong> {value}</p>)}</div><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setAiPreview(null)}>Descartar</Button><Button size="sm" onClick={applyAiFields}>Aplicar sugestões</Button></div></div>}
              </section>
              <div className="grid gap-4 lg:grid-cols-3">
                <div><label className="mb-1 block text-sm font-bold">Queixa principal</label><textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} /></div>
                <div><label className="mb-1 block text-sm font-bold">História atual</label><textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={history} onChange={(e) => setHistory(e.target.value)} /></div>
                <div><label className="mb-1 block text-sm font-bold">Diagnóstico / hipótese</label><textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
              </div>
              <button className="text-sm font-bold text-primary hover:underline" onClick={() => setShowComplement((open) => !open)}>{showComplement ? "Ocultar avaliação complementar" : "Mostrar avaliação complementar"}</button>
              {showComplement && <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-2">
                <Field label="Limitações funcionais" value={limitations} onChange={setLimitations} /> <Field label="Objetivos" value={goals} onChange={setGoals} />
                <Field label="Tratamentos anteriores" value={previousTreatments} onChange={setPreviousTreatments} /> <Field label="Rotina ocupacional" value={occupationRoutine} onChange={setOccupationRoutine} />
                <Field label="Contexto de atividade física" value={physicalActivity} onChange={setPhysicalActivity} /> <Field label="Fatores psicossociais" value={psychosocialFactors} onChange={setPsychosocialFactors} />
                <Field label="Medo-evitação" value={fearAvoidance} onChange={setFearAvoidance} /> <Field label="Bandeiras vermelhas (red flags)" value={redFlags} onChange={setRedFlags} />
                <Field label="Observações" value={obs} onChange={setObs} /> <Field label="Sumário clínico" value={clinicalSummary} onChange={setClinicalSummary} />
              </div>}
              <Button onClick={handleSaveAnamnesis} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Salvando..." : "Salvar anamnese"}</Button>
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
              <div className="flex justify-end">
                <Button onClick={() => setDocModalOpen(true)}>Gerar Documento</Button>
              </div>
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
                      <button
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-accent"
                        onClick={() => {
                          const w = window.open("", "_blank");
                          if (w) {
                            w.document.write(`<html><head><title>${doc.document_title || "Documento"}</title></head><body>${doc.rendered_html || doc.document_body || ""}</body></html>`);
                            w.document.close();
                            w.print();
                          }
                        }}
                      >
                        Imprimir
                      </button>
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

      <Dialog open={docModalOpen} onOpenChange={(open) => !open && setDocModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <div>
              <DialogDescription>Gerar documento</DialogDescription>
              <DialogTitle>Novo Documento</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Título</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex: Relatório de evolução" value={docForm.title} onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Tipo</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="relatorio">Relatório</option>
                  <option value="atestado">Atestado</option>
                  <option value="receituario">Receituário</option>
                  <option value="encaminhamento">Encaminhamento</option>
                  <option value="laudo">Laudo</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Conteúdo (texto)</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={4} placeholder="Corpo do documento..." value={docForm.body} onChange={(e) => setDocForm((f) => ({ ...f, body: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">HTML (opcional, substitui o texto)</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm font-mono" rows={4} placeholder="<p>HTML formatado...</p>" value={docForm.html} onChange={(e) => setDocForm((f) => ({ ...f, html: e.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createDocMutation.mutate()} disabled={createDocMutation.isPending}>
              {createDocMutation.isPending ? "Gerando..." : "Gerar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-1 block text-sm font-bold">{label}</label><textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
