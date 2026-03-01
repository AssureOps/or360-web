import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * Simple route guard:
 * - If there is no Supabase session -> redirect to /login
 * - Otherwise render children.
 *
 * Notes:
 * - Uses a short-lived "checking" state to avoid flicker on refresh.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setAuthed(!!data.session);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      setAuthed(!!session);
      setChecking(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-slate-600">
        Checking session…
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
