import { useState, useRef, useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";

function normPhone(v: string) {
  return v.replace(/\D/g, "");
}

function makeId(prefix: string) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function ExternalFormPage() {
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    birthDate: "",
    insurance: "",
    pathology: "",
    history: "",
  });
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [successData, setSuccessData] = useState<Record<string, string>>({});
  const historyRef = useRef<HTMLTextAreaElement>(null);

  function formatPhone(value: string) {
    const v = normPhone(value).slice(0, 11);
    if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 0) return `(${v}`;
    return "";
  }

  function validate() {
    const errs: string[] = [];
    if (form.name.trim().length < 2) errs.push("name");
    if (normPhone(form.whatsapp).length < 10) errs.push("whatsapp");
    if (!form.insurance) errs.push("insurance");
    if (form.pathology.trim().length < 3) errs.push("pathology");
    if (!day) errs.push("day");
    if (!period) errs.push("period");
    return errs;
  }

  async function handleSubmit() {
    setErrMsg("");
    const errs = validate();
    if (errs.length > 0) {
      if (errs.includes("name")) setErrMsg("Informe seu nome completo.");
      else if (errs.includes("whatsapp")) setErrMsg("WhatsApp inválido.");
      else if (errs.includes("insurance")) setErrMsg("Selecione o convênio.");
      else if (errs.includes("pathology")) setErrMsg("Descreva brevemente o motivo.");
      else if (errs.includes("day")) setErrMsg("Selecione um dia.");
      else if (errs.includes("period")) setErrMsg("Selecione o período.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      const patientId = makeId("p");
      const phone = normPhone(form.whatsapp);

      const taskId = makeId("t");

      const { error: patientErr } = await supabase.from("patients").insert({
        id: patientId,
        name: form.name.trim(),
        whatsapp: phone,
        birth_date: form.birthDate || null,
        pathology: form.pathology.trim(),
        referral_source: "captacao_publica",
        archived: false,
      });

      if (patientErr) throw new Error(patientErr.message);

      const { error: taskErr } = await supabase.from("assistant_tasks").insert({
        id: taskId,
        status: "pending",
        patient_name: form.name.trim(),
        patient_id: patientId,
        phone,
        service_name: form.insurance,
        notes: [form.pathology.trim(), form.history.trim()].filter(Boolean).join(" | "),
        suggested_slots: JSON.stringify([{ day, period }]),
        origin: "captacao_publica",
        needs_review: true,
      });

      if (taskErr) throw new Error(taskErr.message);

      setSuccessData({
        name: form.name.trim(),
        whatsapp: phone,
        pathology: form.pathology.trim(),
        insurance: form.insurance,
        day,
        period,
      });

      setTimeout(() => {
        setSubmitted(true);
        setLoading(false);
      }, 650);

    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
      setLoading(false);
    }
  }

  function resetForm() {
    if (form.name || form.history) {
      if (!confirm("Limpar o formulário? Os dados serão perdidos.")) return;
    }
    setForm({ name: "", whatsapp: "", birthDate: "", insurance: "", pathology: "", history: "" });
    setDay("");
    setPeriod("");
    setErrMsg("");
  }

  if (submitted) {
    return (
      <div style={{ ...styles.wrap, textAlign: "center", paddingTop: 60 }}>
        <div style={styles.card}>
          <div style={{ fontSize: "3.8rem", marginBottom: 12 }}>✅</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: "#10b981", margin: "0 0 8px", fontSize: "1.6rem" }}>Solicitação enviada!</h2>
          <p style={{ color: "#6b7f92", margin: "0 0 18px", lineHeight: 1.65 }}>
            Recebemos seus dados e entraremos em contato pelo WhatsApp para confirmar o melhor horário para sua avaliação.
          </p>
          <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, textAlign: "left", fontSize: ".9rem", lineHeight: 1.9 }}>
            <b>Nome:</b> {successData.name}<br />
            <b>WhatsApp:</b> {successData.whatsapp}<br />
            <b>Patologia:</b> {successData.pathology}<br />
            <b>Convênio:</b> {successData.insurance}<br />
            <b>Preferência:</b> {successData.day} - {successData.period}
          </div>
          <button style={styles.btnPrimary} onClick={() => { setSubmitted(false); resetForm(); }}>
            📋 Nova solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.hero}>
        <div style={styles.brand}>
          <div style={styles.brandBadge} />
          <div>
            <h1 style={styles.h1}>FEMIC Fisioterapia</h1>
            <div style={styles.brandSub}>Araraquara, SP · Agende sua avaliação</div>
          </div>
        </div>
        <p style={styles.lead}>
          Preencha seus dados e escolha o melhor dia e horário para sua <strong>primeira avaliação</strong>.
          Entraremos em contato pelo WhatsApp para confirmar.
        </p>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitle}>📋 Seus dados</div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <div style={styles.field}>
            <label style={styles.label}>Nome completo <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={styles.input}
              placeholder="Digite seu nome completo"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>WhatsApp com DDD <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={styles.input}
              placeholder="(99) 99999-9999"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: formatPhone(e.target.value) }))}
            />
          </div>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
          <div style={styles.field}>
            <label style={styles.label}>Data de nascimento</label>
            <input
              type="date"
              style={styles.input}
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Convênio <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              style={styles.input}
              value={form.insurance}
              onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.value }))}
            >
              <option value="">Selecione...</option>
              <option value="particular">Particular</option>
              <option value="unimed">Unimed</option>
              <option value="hapvida">Hapvida</option>
              <option value="amil">Amil</option>
              <option value="bradesco">Bradesco Saúde</option>
              <option value="sulamerica">SulAmérica</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
        <div style={styles.field}>
          <label style={{ ...styles.label, marginTop: 14 }}>Patologia / motivo da consulta <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            style={styles.input}
            placeholder="Ex.: dor no joelho, lombalgia, tendinite no ombro..."
            value={form.pathology}
            onChange={(e) => setForm((f) => ({ ...f, pathology: e.target.value }))}
          />
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitle}>📅 Preferência de horário</div>
        <p style={{ color: "#6b7f92", fontSize: ".88rem", marginTop: -8, marginBottom: 16 }}>
          Escolha o melhor dia e horário para sua primeira avaliação. É apenas uma preferência — confirmaremos a disponibilidade.
        </p>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <div style={styles.field}>
            <label style={styles.label}>Dia preferido <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["segunda", "terca", "quarta", "quinta", "sexta", "sabado"].map((d) => (
                <button
                  key={d}
                  type="button"
                  style={{
                    ...styles.chip,
                    ...(day === d ? styles.chipActive : {}),
                  }}
                  onClick={() => setDay(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Período <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {["manha", "tarde"].map((p) => (
                <button
                  key={p}
                  type="button"
                  style={{
                    ...styles.chip,
                    ...(period === p ? styles.chipActive : {}),
                  }}
                  onClick={() => setPeriod(p)}
                >
                  {p === "manha" ? "🌅 Manhã" : "☀️ Tarde"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitle}>💬 Histórico rápido</div>
        <div style={styles.field}>
          <label style={styles.label}>Conte um pouco sobre o que aconteceu</label>
          <textarea
            ref={historyRef}
            style={styles.input}
            rows={3}
            maxLength={500}
            placeholder="Ex.: Há duas semanas sinto dor no joelho direito ao subir escadas..."
            value={form.history}
            onChange={(e) => setForm((f) => ({ ...f, history: e.target.value }))}
          />
          <div style={{ fontSize: ".78rem", color: "#6b7f92", textAlign: "right" }}>
            {form.history.length}/500 caracteres
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <button
          style={{
            ...styles.btnPrimary,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? "⏳ Enviando..." : "📅 Solicitar avaliação"}
        </button>
        <button style={styles.btnSecondary} onClick={resetForm}>Limpar</button>
      </div>

      {errMsg && (
        <div style={styles.alertDanger}>
          <strong>⚠️ Não foi possível enviar.</strong><br />
          {errMsg}
        </div>
      )}

      <div style={styles.footer}>
        💡 Após enviar, nossa equipe analisará sua solicitação e entrará em contato pelo WhatsApp para confirmar o melhor horário.
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "24px 16px 52px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#19324a",
    background: "radial-gradient(circle at 0% 0%, rgba(31,182,233,.12), transparent 28%), radial-gradient(circle at 100% 0%, rgba(11,60,111,.10), transparent 26%), #f4f8fb",
    minHeight: "100vh",
  },
  hero: {
    background: "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,255,255,.90))",
    border: "1px solid rgba(11,60,111,.12)",
    borderRadius: 24,
    boxShadow: "0 22px 52px rgba(11,60,111,.12)",
    padding: "22px 24px",
    marginBottom: 14,
  },
  brand: { display: "flex", alignItems: "center", gap: 14, marginBottom: 10 },
  brandBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    background: "linear-gradient(145deg,#0b3c6f,#0d5ea8 58%,#1fb6e9)",
    flexShrink: 0,
    position: "relative" as const,
    overflow: "hidden",
  },
  h1: { margin: 0, fontFamily: "'DM Serif Display', serif", color: "#0b3c6f", fontSize: "1.9rem", letterSpacing: "-.02em" },
  brandSub: { color: "#6b7f92", fontSize: ".88rem", marginTop: 3 },
  lead: { margin: "8px 0 0", color: "#6b7f92", lineHeight: 1.65, fontSize: ".95rem" },
  card: {
    background: "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,255,255,.90))",
    border: "1px solid rgba(11,60,111,.12)",
    borderRadius: 24,
    boxShadow: "0 22px 52px rgba(11,60,111,.12)",
    padding: "22px 24px",
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: "'DM Serif Display', serif",
    color: "#0b3c6f",
    fontSize: "1.12rem",
    fontWeight: 400,
    margin: "0 0 16px",
    paddingBottom: 12,
    borderBottom: "1px solid rgba(11,60,111,.12)",
  },
  field: { display: "grid", gap: 7 },
  label: { color: "#0b3c6f", fontWeight: 700, fontSize: ".93rem" },
  input: {
    width: "100%",
    padding: "13px 15px",
    borderRadius: 16,
    border: "1px solid rgba(11,60,111,.12)",
    background: "#fff",
    color: "#19324a",
    font: "inherit",
    fontSize: ".95rem",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  chip: {
    border: "1px solid rgba(11,60,111,.12)",
    background: "#fff",
    borderRadius: 999,
    padding: "9px 15px",
    cursor: "pointer",
    font: "inherit",
    color: "#19324a",
    fontSize: ".88rem",
    flex: 1,
    minWidth: 120,
    textAlign: "center" as const,
    transition: ".15s ease",
  },
  chipActive: {
    background: "linear-gradient(135deg,#0b3c6f,#0d5ea8)",
    color: "#fff",
    borderColor: "transparent",
  },
  btnPrimary: {
    border: "none",
    borderRadius: 16,
    padding: "13px 20px",
    fontWeight: 800,
    cursor: "pointer",
    font: "inherit",
    fontSize: "1rem",
    background: "linear-gradient(135deg,#0b3c6f,#0d5ea8 58%,#1fb6e9)",
    color: "#fff",
    boxShadow: "0 10px 24px rgba(11,60,111,.16)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    transition: ".2s ease",
  },
  btnSecondary: {
    border: "1px solid rgba(11,60,111,.12)",
    borderRadius: 16,
    padding: "13px 20px",
    fontWeight: 800,
    cursor: "pointer",
    font: "inherit",
    fontSize: "1rem",
    background: "#fff",
    color: "#19324a",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  alertDanger: {
    marginTop: 14,
    padding: "15px 18px",
    borderRadius: 18,
    border: "1px solid rgba(11,60,111,.12)",
    boxShadow: "0 10px 24px rgba(11,60,111,.07)",
    background: "rgba(239,68,68,.08)",
    borderColor: "rgba(239,68,68,.22)",
    color: "#ef4444",
    fontSize: ".95rem",
  },
  footer: {
    marginTop: 14,
    color: "#6b7f92",
    fontSize: ".85rem",
    lineHeight: 1.65,
    paddingTop: 14,
    borderTop: "1px solid rgba(11,60,111,.12)",
  },
};
