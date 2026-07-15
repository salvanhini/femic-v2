import { getSupabase } from "../client";
import type { ClinicRule } from "@/lib/types/database";

export async function fetchClinicRules() {
  const { data, error } = await getSupabase()
    .from("clinic_rules")
    .select("*")
    .order("priority", { ascending: true, nullsLast: true });
  if (error) throw error;
  return data as ClinicRule[];
}

export async function createClinicRule(rule: Partial<ClinicRule>) {
  const { data, error } = await getSupabase()
    .from("clinic_rules")
    .insert(rule)
    .select()
    .single();
  if (error) throw error;
  return data as ClinicRule;
}

export async function updateClinicRule(id: string, updates: Partial<ClinicRule>) {
  const { data, error } = await getSupabase()
    .from("clinic_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ClinicRule;
}

export async function deleteClinicRule(id: string) {
  const { error } = await getSupabase()
    .from("clinic_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
