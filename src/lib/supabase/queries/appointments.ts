import { getSupabase } from "../client";
import type { Appointment, SessionPackage } from "@/lib/types/database";
import { todayIso } from "@/lib/utils/date";

export async function fetchAppointments(from: string, to: string) {
  const { data, error } = await (getSupabase() as any)
    .from("appointments")
    .select("*")
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data as Appointment[];
}

export async function createAppointment(
  appointment: Partial<Appointment>
) {
  const { data, error } = await (getSupabase() as any)
    .from("appointments")
    .insert(appointment)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function fetchPatientActivePackage(patientId: string) {
  const { data, error } = await getSupabase()
    .from("session_packages")
    .select("*")
    .eq("patient_id", patientId)
    .eq("active", true)
    .gt("remaining_sessions", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SessionPackage | null;
}

async function consumePackage(appointmentId: string, patientId: string, serviceId: string | null) {
  const supabase = getSupabase() as any;

  const pkg = await fetchPatientActivePackage(patientId);
  if (!pkg) return;

  if (pkg.service_id && serviceId && pkg.service_id !== serviceId) return;
  const remainingSessions = pkg.remaining_sessions ?? 0;
  if (remainingSessions <= 0) return;

  const { error: updatePkg } = await supabase
    .from("session_packages")
    .update({
      remaining_sessions: remainingSessions - 1,
      active: remainingSessions > 1,
    })
    .eq("id", pkg.id);
  if (updatePkg) throw updatePkg;

  const { error: updateAppt } = await supabase
    .from("appointments")
    .update({ package_consumed: true, session_package_id: pkg.id })
    .eq("id", appointmentId);
  if (updateAppt) throw updateAppt;
}

export async function updateAppointment(
  id: string,
  appointment: Partial<Appointment>
) {
  const supabase = getSupabase() as any;

  const { data: oldAppt } = await supabase
    .from("appointments")
    .select("status, patient_id, service_id")
    .eq("id", id)
    .single();
  if (!oldAppt) throw new Error("Agendamento não encontrado");

  const { data, error } = await supabase
    .from("appointments")
    .update(appointment)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  const newStatus = appointment.status || oldAppt.status;
  if (newStatus === "concluido" && oldAppt.status !== "concluido") {
    await consumePackage(id, oldAppt.patient_id, appointment.service_id || oldAppt.service_id).catch(() => {});
  }

  return data as Appointment;
}

export async function deleteAppointment(id: string) {
  const { error } = await getSupabase()
    .from("appointments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchUpcomingActiveAppointments(patientId: string) {
  const { data, error } = await (getSupabase() as any)
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .gte("appointment_date", todayIso())
    .in("status", ["agendado", "confirmado"])
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data as Appointment[];
}

export async function cancelUpcomingAppointments(patientId: string) {
  const { data, error } = await (getSupabase() as any)
    .from("appointments")
    .update({ status: "cancelado" })
    .eq("patient_id", patientId)
    .gte("appointment_date", todayIso())
    .in("status", ["agendado", "confirmado"])
    .select("id");
  if (error) throw error;
  return (data || []).length;
}

export async function quickUpdateStatus(id: string, status: string) {
  const supabase = getSupabase() as any;

  const { data: oldAppt } = await supabase
    .from("appointments")
    .select("status, patient_id, service_id")
    .eq("id", id)
    .single();
  if (!oldAppt) throw new Error("Agendamento não encontrado");

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;

  if (status === "concluido" && oldAppt.status !== "concluido") {
    await consumePackage(id, oldAppt.patient_id, oldAppt.service_id).catch(() => {});
  }
}
