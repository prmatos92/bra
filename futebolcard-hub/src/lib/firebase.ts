import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isFirebaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Supabase não está configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env",
    );
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}
