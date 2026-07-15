import { getSupabase } from "@/lib/supabase/client";
import type { ClinicalAnamnesis } from "@/lib/types/database";

export type ClinicalAiFields = Partial<Pick<ClinicalAnamnesis,
  "chief_complaint" | "history" | "diagnosis" | "limitations" | "goals" | "obs" |
  "occupation_routine" | "physical_activity_context" | "red_flags" | "previous_treatments" |
  "psychosocial_factors" | "fear_avoidance" | "clinical_summary"
>>;

export async function organizeClinicalDraft(draft: string) {
  const { data, error } = await getSupabase().functions.invoke("clinical-ai", {
    body: { draft },
  });
  if (error) throw error;
  if (!data?.fields || typeof data.fields !== "object") throw new Error("A IA não retornou uma sugestão válida");
  return data.fields as ClinicalAiFields;
}
