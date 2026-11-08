import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Dirección del proyecto y clave pública (publishable/anon). No son secretas:
// la seguridad la dan las reglas de la base de datos (Row Level Security).
// Se configuran en Cloudflare Pages como variables de entorno.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    : null;
