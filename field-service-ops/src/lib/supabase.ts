import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === '1' || !url || !anon || url.includes('YOUR_');

export const supabase: SupabaseClient | null = isDemoMode
  ? null
  : createClient(url, anon);
