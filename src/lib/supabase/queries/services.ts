import { getSupabase } from "../client";
import type { Appointment, Service, HealthInsurance, SessionPackage, ScheduleSettings } from "@/lib/types/database";

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
  const { data, error } = await (getSupabase() as any)
    .from("session_packages")
    .insert(pkg)
    .select()
    .single();
  if (error) throw error;
  return data as SessionPackage;
}

export async function fetchFuturePackageAppointments(pkg: SessionPackage, today: string) {
  let query = getSupabase()
    .from("appointments")
    .select("*")
    .eq("patient_id", pkg.patient_id)
    .gte("appointment_date", today)
    .in("status", ["agendado", "confirmado"])
    .order("appointment_date")
    .order("start_time");
  if (pkg.service_id) query = query.eq("service_id", pkg.service_id);
  const { data, error } = await query;
  if (error) throw error;
  return data as Appointment[];
}

export async function closeSessionPackage(pkg: SessionPackage, reason: string, appointmentIdsToCancel: string[]) {
  const supabase = getSupabase();
  const { error: packageError } = await supabase
    .from("session_packages")
    .update({ active: false, closed_at: new Date().toISOString(), closure_reason: reason.trim() || null } as never)
    .eq("id", pkg.id);
  if (packageError) throw packageError;

  if (appointmentIdsToCancel.length) {
    const { error: appointmentsError } = await supabase
      .from("appointments")
      .update({ status: "cancelado" } as never)
      .in("id", appointmentIdsToCancel);
    if (appointmentsError) throw appointmentsError;
  }
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
  const { error } = await (getSupabase() as any)
    .from("schedule_settings")
    .upsert(settings, { onConflict: "id" });
  if (error) throw error;
}
