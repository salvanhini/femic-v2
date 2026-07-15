import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fmtDate } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Wand2, Eye, Trash2, Copy } from "lucide-react";

interface PatientDocument {
  id: string;
  patient_id: string;
  patient_name: string | null;
  title: string;
  doc_type: string | null;
  content: string | null;
  rendered_html: string | null;
  header_logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  category: string | null;
  url: string | null;
  obs: string | null;
  created_at: string;
}

const DOC_TEMPLATES: Record<string, { title: string; content: string }> = {
  atestado: {
    title: "Atestado Médico",
    content: `ATESTADO

Atesto para os devidos fins que o(a) paciente [NOME_PACIENTE], portador(a) do CPF [CPF], necessita de repouso por [DIAS_REPOUSO] dias, no período de [DATA_INICIO] a [DATA_FIM], em razão de [MOTIVO].

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[REGISTRO_PROFissional]`,
  },
  relatorio: {
    title: "Relatório de Evolução",
    content: `RELATÓRIO DE EVOLUÇÃO CLÍNICA

Paciente: [NOME_PACIENTE]
Data: [DATA]

HISTÓRICO:
[HISTORICO]

Evolução observada:
[EVOLUCAO]

Conduta terapêutica:
[CONDUTA]

Orientações:
[ORIENTACOES]

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[REGISTRO_PROFissional]`,
  },
  receita: {
    title: "Receita",
    content: `RECEITUÁRIO

Paciente: [NOME_PACIENTE]
Data: [DATA]

[PRESCRICOES]

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[REGISTRO_PROFissional]`,
  },
  declaracao: {
    title: "Declaração",
    content: `DECLARAÇÃO

Declaro para os devidos fins que o(a) paciente [NOME_PACIENTE], portador(a) do CPF [CPF], esteve sob meus cuidados profissionais no período de [DATA_INICIO] a [DATA_FIM], realizando tratamento de [TIPO_TRATAMENTO].

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[REGISTRO_PROFissional]`,
  },
  laudo: {
    title: "Laudo Técnico",
    content: `LAUDO TÉCNICO

Paciente: [NOME_PACIENTE]
Data: [DATA]

ANAMNESE:
[ANAMNESE]

EXAME FÍSICO:
[EXAME_FISICO]

HIPÓTESE DIAGNÓSTICA:
[HIPOTESE]

CONDUTA:
[CONDUTA]

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[REGISTRO_PROFissional]`,
  },
  personalizado: {
    title: "Documento Personalizado",
    content: `Escreva o conteúdo do documento aqui...`,
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  atestado: "Atestado",
  relatorio: "Relatório",
  receita: "Receita",
  declaracao: "Declaração",
  laudo: "Laudo",
  personalizado: "Personalizado",
};

const SQL_CREATE_TABLE = `CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  title TEXT NOT NULL,
  doc_type TEXT DEFAULT 'personalizado',
  content TEXT,
  rendered_html TEXT,
  header_logo_url TEXT,
  signature_url TEXT,
  stamp_url TEXT,
  category TEXT DEFAULT 'documento',
  url TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON patient_documents TO authenticated;`;

function renderDocHtml(doc: PatientDocument, patientName?: string): string {
  const name = doc.patient_name || patientName || "Paciente";
  let content = doc.content || "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const local = "Ribeirão Preto, SP";

  content = content.replace(/\[NOME_PACIENTE\]/g, `<strong>${name}</strong>`);
  content = content.replace(/\[DATA\]/g, dateStr);
  content = content.replace(/\[LOCAL\]/g, local);
  content = content.replace(/\n/g, "<br/>");

  const logo = doc.header_logo_url
    ? `<div style="text-align:center;margin-bottom:24px"><img src="${doc.header_logo_url}" style="max-height:80px" /></div>`
    : `<div style="text-align:center;margin-bottom:24px"><strong style="font-size:18px">FEMIC Fisioterapia</strong></div>`;

  const signature = doc.signature_url
    ? `<div style="text-align:center;margin-top:40px"><img src="${doc.signature_url}" style="max-height:60px" /></div>`
    : "";

  const stamp = doc.stamp_url
    ? `<div style="position:absolute;bottom:40px;right:40px;opacity:0.3"><img src="${doc.stamp_url}" style="max-height:100px" /></div>`
    : "";

  return `
    <div style="font-family:serif;max-width:700px;margin:0 auto;padding:40px;position:relative">
      ${logo}
      <div style="white-space:pre-wrap;line-height:1.8;font-size:14px">${content}</div>
      ${signature}
      ${stamp}
    </div>
  `;
}

export default function DocumentosPacientePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editing, setEditing] = useState<PatientDocument | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const [showTableInfo, setShowTableInfo] = useState(false);

  const [form, setForm] = useState({
    patient_id: "",
    title: "",
    doc_type: "personalizado",
    content: "",
    header_logo_url: "",
    signature_url: "",
    stamp_url: "",
    obs: "",
  });

  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const { data: documents = [], isLoading, error: queryError } = useQuery({
    queryKey: ["patient_documents"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("patient_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.message.includes("relation") || error.message.includes("does not exist")) {
          setShowTableInfo(true);
          return [];
        }
        throw error;
      }
      return (data || []) as PatientDocument[];
    },
  });

  const filtered = documents.filter((d) => {
    if (filterType !== "all" && d.doc_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        d.title?.toLowerCase().includes(s) ||
        d.patient_name?.toLowerCase().includes(s) ||
        patientMap.get(d.patient_id)?.name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patientName = patientMap.get(form.patient_id)?.name || null;
      const payload = {
        patient_id: form.patient_id,
        patient_name: patientName,
        title: form.title,
        doc_type: form.doc_type,
        content: form.content,
        rendered_html: renderDocHtml({ ...form, patient_name: patientName } as PatientDocument, patientName || undefined),
        header_logo_url: form.header_logo_url || null,
        signature_url: form.signature_url || null,
        stamp_url: form.stamp_url || null,
        category: form.doc_type,
        obs: form.obs || null,
      };
      if (editing) {
        const { error } = await getSupabase().from("patient_documents").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await getSupabase().from("patient_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient_documents"] });
      toast.success(editing ? "Documento atualizado" : "Documento criado");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("patient_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient_documents"] });
      toast.success("Documento excluído");
    },
  });

  function openNew(docType?: string) {
    setEditing(null);
    const tpl = DOC_TEMPLATES[docType || "personalizado"];
    setForm({
      patient_id: "",
      title: tpl.title,
      doc_type: docType || "personalizado",
      content: tpl.content,
      header_logo_url: "",
      signature_url: "",
      stamp_url: "",
      obs: "",
    });
    setModalOpen(true);
  }

  function openEdit(doc: PatientDocument) {
    setEditing(doc);
    setForm({
      patient_id: doc.patient_id,
      title: doc.title,
      doc_type: doc.doc_type || "personalizado",
      content: doc.content || "",
      header_logo_url: doc.header_logo_url || "",
      signature_url: doc.signature_url || "",
      stamp_url: doc.stamp_url || "",
      obs: doc.obs || "",
    });
    setModalOpen(true);
  }

  function handleDuplicate(doc: PatientDocument) {
    setEditing(null);
    setForm({
      patient_id: doc.patient_id,
      title: doc.title + " (cópia)",
      doc_type: doc.doc_type || "personalizado",
      content: doc.content || "",
      header_logo_url: doc.header_logo_url || "",
      signature_url: doc.signature_url || "",
      stamp_url: doc.stamp_url || "",
      obs: doc.obs || "",
    });
    setModalOpen(true);
  }

  function handlePreview(doc: PatientDocument) {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  }

  async function handleGenerateAI() {
    toast.info("Geração com IA será disponibilizada em breve. Por enquanto, edite o conteúdo manualmente.");
  }

  if (showTableInfo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Documentos do Paciente</h2>
          <Button onClick={() => openNew()}>Novo Documento</Button>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="mb-2 font-bold text-lg">Tabela não encontrada</p>
          <p className="mb-4 text-sm text-muted-foreground">
            A tabela <code>patient_documents</code> precisa ser criada no Supabase.
          </p>
          <p className="text-sm text-muted-foreground">Execute este SQL no SQL Editor:</p>
          <pre className="mt-4 rounded-lg bg-muted p-4 text-left text-xs overflow-x-auto">{SQL_CREATE_TABLE}</pre>
          <Button className="mt-4" onClick={() => { setShowTableInfo(false); }}>Entendido</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Documentos do Paciente</h2>
        <Button onClick={() => openNew()}>Novo Documento</Button>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(DOC_TEMPLATES).map(([key, tpl]) => (
          <button
            key={key}
            className="flex flex-col items-center gap-1 rounded-xl border bg-card p-3 text-center transition-colors hover:bg-accent"
            onClick={() => openNew(key)}
          >
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs font-bold">{tpl.title}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          className="w-56 rounded-lg border px-3 py-2 text-sm"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">Todos os tipos</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum documento encontrado.</p>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className="cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:bg-accent" onClick={() => openEdit(doc)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{doc.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.patient_name || patientMap.get(doc.patient_id)?.name || "—"} · {DOC_TYPE_LABELS[doc.doc_type || "personalizado"] || doc.doc_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                    title="Visualizar"
                    onClick={(e) => { e.stopPropagation(); handlePreview(doc); }}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                    title="Duplicar"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    title="Excluir"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Excluir este documento?")) deleteMutation.mutate(doc.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">{doc.created_at ? fmtDate(doc.created_at) : ""}</span>
                </div>
              </div>
              {doc.obs && <p className="mt-1 text-sm text-muted-foreground">{doc.obs}</p>}
            </div>
          ))
        )}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div>
              <DialogDescription>Documento</DialogDescription>
              <DialogTitle>{editing ? "Editar documento" : "Novo documento"}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold text-muted-foreground">Paciente *</Label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.patient_id}
                    onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {patients.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold text-muted-foreground">Tipo</Label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.doc_type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm((f) => ({
                        ...f,
                        doc_type: t,
                        title: DOC_TEMPLATES[t]?.title || f.title,
                        content: DOC_TEMPLATES[t]?.content || f.content,
                      }));
                    }}>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-bold text-muted-foreground">Título *</Label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground">Conteúdo</Label>
                  <button
                    className="flex items-center gap-1 rounded bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700 hover:bg-purple-200"
                    onClick={handleGenerateAI}
                  >
                    <Wand2 className="h-3 w-3" /> Gerar com IA
                  </button>
                </div>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  rows={14}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold text-muted-foreground">Logo (URL)</Label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://..." value={form.header_logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, header_logo_url: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold text-muted-foreground">Assinatura (URL)</Label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://..." value={form.signature_url}
                    onChange={(e) => setForm((f) => ({ ...f, signature_url: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold text-muted-foreground">Carimbo (URL)</Label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://..." value={form.stamp_url}
                    onChange={(e) => setForm((f) => ({ ...f, stamp_url: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-bold text-muted-foreground">Observações</Label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={form.obs}
                  onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.patient_id || !form.title}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={(open) => !open && setPreviewOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div>
              <DialogDescription>Preview</DialogDescription>
              <DialogTitle>{previewDoc?.title}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            {previewDoc && (
              <div
                className="rounded-lg border bg-white p-4"
                dangerouslySetInnerHTML={{
                  __html: previewDoc.rendered_html || renderDocHtml(previewDoc),
                }}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
