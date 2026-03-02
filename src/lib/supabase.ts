import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL!;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

if (import.meta.env.DEV) {
  console.log("SUPABASE URL =", url);
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: `or360-auth-${url}`,
  },
});

// 👇 expose client in browser console (dev only)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__sb = supabase;
}