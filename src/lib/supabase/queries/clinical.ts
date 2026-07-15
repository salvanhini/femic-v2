import { getSupabase } from "../client";
import type { ClinicalAnamnesis, ClinicalEvolution } from "@/lib/types/database";

export async function fetchAnamnesis(patientId: string) {
  const { data, error } = await getSupabase()
    .from("clinical_anamneses")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (error) throw error;
  return data as ClinicalAnamnesis | null;
}

export async function upsertAnamnesis(
  anamnesis: Partial<ClinicalAnamnesis>
) {
  const { data, error } = await (getSupabase() as any)
    .from("clinical_anamneses")
    .upsert(anamnesis, { onConflict: "patient_id" })
    .select()
    .single();
  if (error) throw error;
  return data as ClinicalAnamnesis;
}

export async function fetchEvolutions(patientId: string) {
  const { data, error } = await getSupabase()
    .from("clinical_evolutions")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data as ClinicalEvolution[];
}

export async function createEvolution(
  evolution: Partial<ClinicalEvolution>
) {
  const { data, error } = await (getSupabase() as any)
    .from("clinical_evolutions")
    .insert(evolution)
    .select()
    .single();
  if (error) throw error;
  return data as ClinicalEvolution;
}

export async function deleteEvolution(id: string) {
  const { error } = await getSupabase()
    .from("clinical_evolutions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
