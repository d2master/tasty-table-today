import { useEffect, useState, useCallback } from "react";

export interface WaiterSession {
  token: string;
  waiter: {
    id: string;
    name: string;
    restaurant_id: string;
    restaurant_slug: string;
    restaurant_name: string;
  };
}

const KEY = "waiter_session";

export function loadWaiterSession(): WaiterSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WaiterSession) : null;
  } catch {
    return null;
  }
}

export function saveWaiterSession(s: WaiterSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearWaiterSession() {
  localStorage.removeItem(KEY);
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function callWaiterApi(action: string, body: unknown, token?: string) {
  const url = `${SUPABASE_URL}/functions/v1/waiter-api/${action}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${SUPABASE_ANON}`,
  };
  if (token) headers["x-waiter-token"] = token;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || "Erro na requisição");
  return data;
}

export function useWaiterSession() {
  const [session, setSession] = useState<WaiterSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(loadWaiterSession());
    setLoading(false);
  }, []);

  const login = useCallback(async (slug: string, username: string, password: string) => {
    const data = await callWaiterApi("login", { slug, username, password });
    const s: WaiterSession = { token: data.token, waiter: data.waiter };
    saveWaiterSession(s);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    if (session?.token) {
      try { await callWaiterApi("logout", {}, session.token); } catch { /* ignore */ }
    }
    clearWaiterSession();
    setSession(null);
  }, [session?.token]);

  return { session, loading, login, logout };
}
