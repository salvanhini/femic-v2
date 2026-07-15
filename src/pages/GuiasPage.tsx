import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { fetchPatients } from "@/lib/supabase/queries/patients";
import { fetchHealthInsurances } from "@/lib/supabase/queries/services";
import { fmtDate } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface HealthInsuranceGuide {
  id: string;
  patient_id: string;
  health_insurance_id: string;
  authorization_number: string | null;
  authorization_date: string | null;
  expiration_date: string | null;
  authorized_sessions: number | null;
  used_sessions: number | null;
  drive_url: string | null;
  obs: string | null;
  created_at: string;
}

export default function GuiasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HealthInsuranceGuide | null>(null);
  const [form, setForm] = useState({
    patient_id: "", health_insurance_id: "", authorization_number: "",
    authorization_date: "", expiration_date: "", authorized_sessions: "0",
    used_sessions: "0", drive_url: "", obs: "",
  });

  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: insurances = [] } = useQuery({ queryKey: ["health_insurances"], queryFn: fetchHealthInsurances });

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["health_insurance_guides"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("health_insurance_guides")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.message.includes("relation") || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      return data as HealthInsuranceGuide[];
    },
  });

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const insuranceMap = new Map(insurances.map((i) => [i.id, i]));

  const filtered = guides.filter((g) =>
    !search || patientMap.get(g.patient_id)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      const payload = {
        patient_id: form.patient_id,
        health_insurance_id: form.health_insurance_id,
        authorization_number: form.authorization_number || null,
        authorization_date: form.authorization_date || null,
        expiration_date: form.expiration_date || null,
        authorized_sessions: parseInt(form.authorized_sessions) || 0,
        used_sessions: parseInt(form.used_sessions) || 0,
        drive_url: form.drive_url || null,
        obs: form.obs || null,
      };

      if (editing) {
        const { error } = await supabase.from("health_insurance_guides").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("health_insurance_guides").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health_insurance_guides"] });
      toast.success(editing ? "Guia atualizada" : "Guia criada");
      setModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  function openNew() {
    setEditing(null);
    setForm({ patient_id: "", health_insurance_id: "", authorization_number: "",
      authorization_date: "", expiration_date: "", authorized_sessions: "0",
      used_sessions: "0", drive_url: "", obs: "" });
    setModalOpen(true);
  }

  function openEdit(guide: HealthInsuranceGuide) {
    setEditing(guide);
    setForm({
      patient_id: guide.patient_id,
      health_insurance_id: guide.health_insurance_id,
      authorization_number: guide.authorization_number || "",
      authorization_date: guide.authorization_date || "",
      expiration_date: guide.expiration_date || "",
      authorized_sessions: String(guide.authorized_sessions || 0),
      used_sessions: String(guide.used_sessions || 0),
      drive_url: guide.drive_url || "",
      obs: guide.obs || "",
    });
    setModalOpen(true);
  }

  if (!isLoading && guides.length === 0 && !modalOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Guias de Convênio</h2>
          <Button onClick={openNew}>Nova Guia</Button>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="mb-2 font-bold text-lg">Tabela não encontrada</p>
          <p className="mb-4 text-sm text-muted-foreground">
            A tabela <code>health_insurance_guides</code> precisa ser criada no Supabase.
          </p>
          <p className="text-sm text-muted-foreground">
            Execute este SQL no SQL Editor do Supabase:
          </p>
          <pre className="mt-4 rounded-lg bg-muted p-4 text-left text-xs overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS health_insurance_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  health_insurance_id UUID REFERENCES health_insurances(id) ON DELETE SET NULL,
  authorization_number TEXT,
  authorization_date DATE,
  expiration_date DATE,
  authorized_sessions INTEGER DEFAULT 0,
  used_sessions INTEGER DEFAULT 0,
  drive_url TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE health_insurance_guides ENABLE ROW LEVEL SECURITY;
GRANT ALL ON health_insurance_guides TO authenticated;`}
          </pre>
          <Button className="mt-4" onClick={openNew}>Nova Guia</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Guias de Convênio</h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="w-56 rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar por paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={openNew}>Nova Guia</Button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhuma guia encontrada.</p>
        ) : (
          filtered.map((guide) => (
            <div
              key={guide.id}
              className="cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
              onClick={() => openEdit(guide)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{patientMap.get(guide.patient_id)?.name || "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {insuranceMap.get(guide.health_insurance_id)?.name || "—"}
                    {guide.authorization_number && ` · Nº ${guide.authorization_number}`}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-600">
                    {guide.used_sessions || 0}/{guide.authorized_sessions || 0} sessões
                  </span>
                  {guide.expiration_date && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-600">
                      Vence {fmtDate(guide.expiration_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div>
              <DialogDescription>Guias de convênio</DialogDescription>
              <DialogTitle>{editing ? "Editar guia" : "Nova guia"}</DialogTitle>
            </div>
            <DialogClose className="rounded-lg p-2 hover:bg-accent">✕</DialogClose>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Paciente *</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.patient_id}
                  onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Convênio *</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.health_insurance_id}
                  onChange={(e) => setForm((f) => ({ ...f, health_insurance_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {insurances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Nº Autorização</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.authorization_number}
                    onChange={(e) => setForm((f) => ({ ...f, authorization_number: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Data autorização</label>
                  <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.authorization_date}
                    onChange={(e) => setForm((f) => ({ ...f, authorization_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Validade</label>
                  <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.expiration_date}
                    onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Sessões auth.</label>
                  <input type="number" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.authorized_sessions}
                    onChange={(e) => setForm((f) => ({ ...f, authorized_sessions: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Sessões usadas</label>
                  <input type="number" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.used_sessions}
                    onChange={(e) => setForm((f) => ({ ...f, used_sessions: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">URL do Drive</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://drive.google.com/..." value={form.drive_url}
                  onChange={(e) => setForm((f) => ({ ...f, drive_url: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Observações</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={form.obs}
                  onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.patient_id || !form.health_insurance_id}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}