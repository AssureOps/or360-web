import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("SUPABASE URL =", url);

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: `or360-auth-${import.meta.env.VITE_SUPABASE_URL}`,

    },
  }
);


// 👇 expose client in browser console (dev only)
if (typeof window !== "undefined") {
  (window as any).__sb = supabase;
}
