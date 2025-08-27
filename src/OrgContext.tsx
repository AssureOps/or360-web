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
  const [orgId, setOrgIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("or360.orgId") : null
  );

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("or360.orgId", id);
  };

  const refresh = async () => {
    // ensure signed in (demo creds)
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      const email = import.meta.env.VITE_DEMO_EMAIL as string;
      const password = import.meta.env.VITE_DEMO_PASSWORD as string;
      await supabase.auth.signInWithPassword({ email, password });
    }

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) { setOrgs([]); return; }

    // fetch orgs where this user is a member
    const { data, error } = await supabase
      .from("orgs")
      .select("id,name, org_members!inner(user_id)")
      .eq("org_members.user_id", uid);

    if (error) { console.error(error.message); setOrgs([]); return; }

    const list: Org[] = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
    setOrgs(list);

    // set default if none or invalid
    if ((!orgId || !list.find(o => o.id === orgId)) && list.length) {
      setOrgId(list[0].id);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const value = useMemo<OrgCtx>(() => ({ orgs, orgId, setOrgId, refresh }), [orgs, orgId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrg must be used inside OrgProvider");
  return v;
}
