import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

export const supabase: SupabaseClient | null = CONFIG.AUTH_ENABLED
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
