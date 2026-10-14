import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) setLockedUntil(null);
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - now) : 0;
  const mm = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil) return;
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.functions.invoke("restaurant-login", {
      body: { email: normalizedEmail, password },
    });
    let body: any = data;
    if (error) {
      try { body = await (error as any).context?.json?.(); } catch { body = null; }
    }
    if (body?.access_token) {
      const { error: sErr } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      setLoading(false);
      if (sErr) { toast.error("Não foi possível entrar. Tente novamente."); return; }
      navigate("/dashboard");
      return;
    }
    setLoading(false);
    if (body?.error === "locked") {
      setLockedUntil(new Date(body.locked_until).getTime());
      setNow(Date.now());
      toast.error("Muitas tentativas incorretas. Login bloqueado por 15 minutos.");
    } else if (body?.error === "invalid_credentials") {
      toast.error(`Email ou senha inválidos. Restam ${body.remaining} tentativa(s).`);
    } else {
      toast.error("Email ou senha inválidos. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="font-display text-2xl font-bold text-primary">🍔 MenuDigital</Link>
          <p className="mt-2 text-muted-foreground">Entre na sua conta</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            <div className="text-right">
              <Link to="/esqueci-senha" className="text-xs text-muted-foreground hover:text-primary hover:underline">Esqueci minha senha</Link>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link to="/cadastro" className="text-primary font-medium hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
