import { getSupabase } from "../client";
import type { Patient } from "@/lib/types/database";

export async function fetchPatients() {
  const { data, error } = await getSupabase()
    .from("patients")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Patient[];
}

export async function createPatient(patient: Partial<Patient>) {
  const { data, error } = await (getSupabase() as any)
    .from("patients")
    .insert(patient)
    .select()
    .single();
  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
  const { data, error } = await (getSupabase() as any)
    .from("patients")
    .update(patient)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Patient;
}
