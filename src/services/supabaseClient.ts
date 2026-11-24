/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const directSupabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://yacfwgdbtojuzdnpqfdm.supabase.co';

// En el navegador enrutamos las peticiones a través del mismo dominio (/supabase)
// mediante el proxy de Vercel (vercel.json) y Vite (vite.config.ts) para evitar
// falsos positivos de antivirus (como Bitdefender) sobre el subdominio *.supabase.co.
const supabaseUrl =
  typeof window !== 'undefined'
    ? `${window.location.origin}/supabase`
    : directSupabaseUrl;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_wBRMcwxiMXfyPOYcyFuLMA_0-3yVFWV';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const DEMO_CREDENTIALS = {
  email: 'demo.portfolio.gastos@gmail.com',
  password: 'DemoPortfolio2026!',
};
