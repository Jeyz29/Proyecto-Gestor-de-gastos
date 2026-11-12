/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://yacfwgdbtojuzdnpqfdm.supabase.co';
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
