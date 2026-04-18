import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(true);

  useEffect(() => {
    // Garante que o admin inicial existe
    supabase.functions.invoke("admin-seed").finally(() => setSeeding(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      toast.error("Credenciais inválidas");
      setLoading(false);
      return;
    }
    // Verifica se é admin
    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!adminCheck) {
      await supabase.auth.signOut();
      toast.error("Esta conta não é administradora");
      setLoading(false);
      return;
    }
    toast.success("Bem-vindo, admin");
    navigate("/admin/dashboard");
  };

  const handleForgot = async () => {
    if (!email) return toast.error("Informe seu email primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Email de redefinição enviado");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-xl p-8 border">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Painel Admin</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading || seeding}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <button
            type="button"
            onClick={handleForgot}
            className="text-sm text-primary hover:underline w-full text-center"
          >
            Esqueci minha senha
          </button>
        </form>
      </div>
    </div>
  );
}
