import { getSupabase } from "../client";
import type { Appointment } from "@/lib/types/database";

export async function fetchAppointments(from: string, to: string) {
  const { data, error } = await getSupabase()
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
  const { data, error } = await getSupabase()
    .from("appointments")
    .insert(appointment)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointment(
  id: string,
  appointment: Partial<Appointment>
) {
  const { data, error } = await getSupabase()
    .from("appointments")
    .update(appointment)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function deleteAppointment(id: string) {
  const { error } = await getSupabase()
    .from("appointments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function quickUpdateStatus(id: string, status: string) {
  const { error } = await getSupabase()
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}
