// src/OrgContext.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export type Org = { id: string; name: string };

type OrgCtx = {
  orgs: Org[];
  orgId: string | null;
  setOrgId: (id: string) => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<OrgCtx | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(
    localStorage.getItem("orgId") || null
  );

  useEffect(() => {
    localStorage.setItem("orgId", orgId || "");
  }, [orgId]);

  const refresh = async () => {
    // 0) Ensure we have a session (auto sign-in using demo creds if provided)
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      const email = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
      const password = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
      if (email && password) {
        await supabase.auth.signInWithPassword({ email, password });
      }
    }

    // 1) Get current user id
    const { data: me } = await supabase.auth.getUser();
    const uid = me?.user?.id;

    // 2) Query orgs by membership
    let list: Org[] = [];
    if (uid) {
      const { data, error } = await supabase
        .from("orgs")
        .select("id,name, org_members!inner(user_id, status)")
        .eq("org_members.user_id", uid)
        .eq("org_members.status", "active")
        .order("name", { ascending: true });
      if (!error && data) {
        list = data.map((o: any) => ({ id: o.id, name: o.name }));
      }
    }

    // 3) Fallback: show all orgs (requires RLS policy allowing it for superadmins)
    if (list.length === 0) {
      const { data } = await supabase
        .from("orgs")
        .select("id,name")
        .order("name", { ascending: true })
        .limit(25);
      list = (data || []) as Org[];
    }

    setOrgs(list);
    if (!orgId && list.length) setOrgId(list[0].id);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<OrgCtx>(
    () => ({ orgs, orgId, setOrgId, refresh }),
    [orgs, orgId]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrg must be used inside OrgProvider");
  return v;
}
