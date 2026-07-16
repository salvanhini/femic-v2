import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fields = [
  "chief_complaint", "history", "diagnosis", "clinical_summary",
];

const systemPrompt = `Você organiza um rascunho fornecido por um profissional de fisioterapia. Retorne SOMENTE JSON com os campos: ${fields.join(", ")}.
Use texto breve, direto e fiel ao rascunho. "clinical_summary" será exibido como "Avaliação complementar": reúna nele somente achados relevantes, contexto clínico e pontos de atenção mencionados no relato. Não invente fatos, diagnóstico, conduta ou alertas. Para informações ausentes, use string vazia. "diagnosis" deve preservar hipótese relatada, sem criar uma nova.`;

function parseJson(content: string) {
  const clean = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(clean);
  return Object.fromEntries(fields.map((field) => [field, typeof parsed[field] === "string" ? parsed[field].trim() : ""]));
}

async function callOpenAiCompatible(url: string, apiKey: string, model: string, draft: string, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: draft }],
    }),
  });
  if (!response.ok) throw new Error(`Provedor respondeu ${response.status}`);
  const data = await response.json();
  return parseJson(data.choices?.[0]?.message?.content || "");
}

async function callGemini(apiKey: string, model: string, draft: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: draft }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 900, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) throw new Error(`Provedor respondeu ${response.status}`);
  const data = await response.json();
  return parseJson(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

type LocalAiConfig = {
  provider: "groq" | "openrouter" | "gemini";
  apiKey: string;
  model: string;
};

function getLocalAiConfig(value: unknown): LocalAiConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Record<string, unknown>;
  if (!(["groq", "openrouter", "gemini"] as const).includes(config.provider as LocalAiConfig["provider"])) return null;
  if (typeof config.apiKey !== "string" || !config.apiKey.trim()) return null;
  return {
    provider: config.provider as LocalAiConfig["provider"],
    apiKey: config.apiKey.trim(),
    model: typeof config.model === "string" ? config.model.trim() : "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Não autorizado" }, { status: 401, headers: corsHeaders });

    const { draft, config } = await req.json();
    if (typeof draft !== "string" || draft.trim().length < 10 || draft.length > 12000) {
      return Response.json({ error: "Informe um rascunho entre 10 e 12.000 caracteres" }, { status: 400, headers: corsHeaders });
    }

    const attempts: Array<() => Promise<Record<string, string>>> = [];
    const localConfig = getLocalAiConfig(config);
    if (localConfig?.provider === "groq") attempts.push(() => callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", localConfig.apiKey, localConfig.model || "llama-3.3-70b-versatile", draft));
    if (localConfig?.provider === "openrouter") attempts.push(() => callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", localConfig.apiKey, localConfig.model || "google/gemini-2.0-flash-001", draft, { "HTTP-Referer": Deno.env.get("APP_URL") || "", "X-OpenRouter-Title": "FEMIC" }));
    if (localConfig?.provider === "gemini") attempts.push(() => callGemini(localConfig.apiKey, localConfig.model || "gemini-2.0-flash", draft));
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (groqKey) attempts.push(() => callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", groqKey, Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile", draft));
    const routerKey = Deno.env.get("OPENROUTER_API_KEY");
    if (routerKey) attempts.push(() => callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", routerKey, Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.0-flash-001", draft, { "HTTP-Referer": Deno.env.get("APP_URL") || "", "X-OpenRouter-Title": "FEMIC" }));
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey) attempts.push(() => callGemini(geminiKey, Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash", draft));

    for (const attempt of attempts) {
      try { return Response.json({ fields: await attempt() }, { headers: corsHeaders }); } catch (_) { /* tenta o próximo provedor */ }
    }
    return Response.json({ error: "Nenhum provedor de IA está disponível" }, { status: 503, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao organizar o prontuário" }, { status: 500, headers: corsHeaders });
  }
});
