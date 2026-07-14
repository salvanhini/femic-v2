import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

let supabase: SupabaseClient<Database> | null = null;

function getStoredUrl(): string {
  return localStorage.getItem("femic_supabase_url") || "";
}

function getStoredKey(): string {
  return localStorage.getItem("femic_supabase_anon_key") || "";
}

export function getSupabase(): SupabaseClient<Database> {
  const url = getStoredUrl() || import.meta.env.VITE_SUPABASE_URL || "";
  const key = getStoredKey() || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabase || supabase.supabaseUrl !== url || supabase.supabaseKey !== key) {
    supabase = createClient<Database>(url, key);
  }
  return supabase;
}

export function configureSupabase(url: string, key: string) {
  localStorage.setItem("femic_supabase_url", url.trim());
  localStorage.setItem("femic_supabase_anon_key", key.trim());
  supabase = null;
}

export function hasSupabaseConfig(): boolean {
  return !!(getStoredUrl() || import.meta.env.VITE_SUPABASE_URL);
}

export function getSupabaseUrl(): string {
  return getStoredUrl() || import.meta.env.VITE_SUPABASE_URL || "";
}

export function getSupabaseAnonKey(): string {
  return getStoredKey() || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}
