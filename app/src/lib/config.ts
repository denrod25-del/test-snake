// Read from Vite env vars at build time, with safe fallbacks.
// Set these in `.env.local` (see SETUP.md):
//   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=...
//   VITE_PRO_PRICE_DISPLAY=$49

export const CONFIG = {
  SUPABASE_URL:      import.meta.env.VITE_SUPABASE_URL      ?? '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  SITE_URL:          import.meta.env.VITE_SITE_URL          ?? 'https://deedscout.netlify.app',
  PRO_PRICE_DISPLAY: import.meta.env.VITE_PRO_PRICE_DISPLAY ?? '$49',
  AUTH_ENABLED:      Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;

export function getAuthRedirectUrl(): string {
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocal) {
    return `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/#/account`;
  }
  return `${CONFIG.SITE_URL.replace(/\/+$/, '')}/#/account`;
}
