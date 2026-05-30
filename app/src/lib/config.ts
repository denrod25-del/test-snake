// Read from Vite env vars at build time, with safe fallbacks.
// Set these in `.env.local` (see SETUP.md):
//   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=...
//   VITE_PRO_PRICE_DISPLAY=$49

export const CONFIG = {
  SUPABASE_URL:      import.meta.env.VITE_SUPABASE_URL      ?? '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  PRO_PRICE_DISPLAY: import.meta.env.VITE_PRO_PRICE_DISPLAY ?? '$49',
  AUTH_ENABLED:      Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;
