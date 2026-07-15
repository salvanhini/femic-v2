import { getSupabase } from "../client";
import type { Service, HealthInsurance, SessionPackage, ScheduleSettings } from "@/lib/types/database";

export async function fetchServices() {
  const { data, error } = await getSupabase()
    .from("services")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Service[];
}

export async function fetchHealthInsurances() {
  const { data, error } = await getSupabase()
    .from("health_insurances")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as HealthInsurance[];
}

export async function fetchSessionPackages() {
  const { data, error } = await getSupabase()
    .from("session_packages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SessionPackage[];
}

export async function fetchPatientPackages(patientId: string) {
  const { data, error } = await getSupabase()
    .from("session_packages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SessionPackage[];
}

export async function createSessionPackage(pkg: { patient_id: string; service_id?: string | null; total_sessions: number; remaining_sessions: number }) {
  const { data, error } = await getSupabase()
    .from("session_packages")
    .insert(pkg)
    .select()
    .single();
  if (error) throw error;
  return data as SessionPackage;
}

export async function fetchScheduleSettings() {
  const { data, error } = await getSupabase()
    .from("schedule_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ScheduleSettings | null;
}

export async function upsertScheduleSettings(settings: Partial<ScheduleSettings>) {
  const { error } = await getSupabase()
    .from("schedule_settings")
    .upsert(settings, { onConflict: "id" });
  if (error) throw error;
}
