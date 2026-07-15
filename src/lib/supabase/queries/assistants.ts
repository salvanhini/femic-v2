import { getSupabase } from "../client";
import type { GeneratedDocument, AssistantTask } from "@/lib/types/database";

export async function fetchDocuments(patientId?: string) {
  let query = getSupabase()
    .from("femic_generated_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as GeneratedDocument[];
}

export async function fetchTasks(filters?: { status?: string; origin?: string }) {
  let query = getSupabase()
    .from("assistant_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.origin) query = query.eq("origin", filters.origin);

  const { data, error } = await query;
  if (error) throw error;
  return data as AssistantTask[];
}

export async function updateTask(id: string, updates: Partial<AssistantTask>) {
  const { data, error } = await getSupabase()
    .from("assistant_tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AssistantTask;
}

export async function createDocument(doc: Partial<GeneratedDocument>) {
  const { data, error } = await getSupabase()
    .from("femic_generated_documents")
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data as GeneratedDocument;
}

export async function createTask(task: Partial<AssistantTask>) {
  const { data, error } = await getSupabase()
    .from("assistant_tasks")
    .insert(task)
    .select()
    .single();
  if (error) throw error;
  return data as AssistantTask;
}

export async function deleteTask(id: string) {
  const { error } = await getSupabase()
    .from("assistant_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchFormResponses(patientId?: string) {
  let query = getSupabase()
    .from("patient_form_responses")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (patientId) {
    query = query.eq("linked_patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAppointmentCount(patientId: string) {
  const { count, error } = await getSupabase()
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId);
  if (error) throw error;
  return count || 0;
}
