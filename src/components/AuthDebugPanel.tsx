"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthDebugPanel() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [cookies, setCookies] = useState<string>("");

  useEffect(() => {
    async function fetchSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);
    }
    fetchSession();
    setCookies(document.cookie);
  }, []);

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, background: "#222", color: "#fff", zIndex: 99999, fontSize: 12, padding: 8, maxWidth: 400, borderTopRightRadius: 8, opacity: 0.95 }}>
      <div><b>Supabase Session:</b> <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(session, null, 2)}</pre></div>
      <div><b>User:</b> <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(user, null, 2)}</pre></div>
      <div><b>Cookies:</b> <pre style={{ whiteSpace: "pre-wrap" }}>{cookies}</pre></div>
    </div>
  );
}
