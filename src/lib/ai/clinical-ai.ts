import { getSupabase } from "@/lib/supabase/client";
import type { ClinicalAnamnesis } from "@/lib/types/database";

const CLINICAL_AI_STORAGE_KEY = "femic_clinical_ai_config";

export type ClinicalAiProvider = "groq" | "openrouter" | "gemini";

export interface ClinicalAiConfig {
  provider: ClinicalAiProvider;
  apiKey: string;
  model: string;
}

export type ClinicalAiFields = Partial<Pick<ClinicalAnamnesis,
  "chief_complaint" | "history" | "diagnosis" | "clinical_summary"
>>;

export function getClinicalAiConfig(): ClinicalAiConfig | null {
  try {
    const raw = localStorage.getItem(CLINICAL_AI_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as Partial<ClinicalAiConfig>;
    if (!config.provider || !["groq", "openrouter", "gemini"].includes(config.provider)) return null;
    return {
      provider: config.provider as ClinicalAiProvider,
      apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
      model: typeof config.model === "string" ? config.model : "",
    };
  } catch {
    return null;
  }
}

export function configureClinicalAi(config: ClinicalAiConfig) {
  localStorage.setItem(CLINICAL_AI_STORAGE_KEY, JSON.stringify({
    provider: config.provider,
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  }));
}

export async function organizeClinicalDraft(draft: string) {
  const config = getClinicalAiConfig();
  const { data, error } = await getSupabase().functions.invoke("clinical-ai", {
    body: { draft, config: config?.apiKey ? config : undefined },
  });
  if (error) throw error;
  if (!data?.fields || typeof data.fields !== "object") throw new Error("A IA não retornou uma sugestão válida");
  return data.fields as ClinicalAiFields;
}
