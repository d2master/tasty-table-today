import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const getSignupErrorMessage = (code?: string, fallback?: string) => {
  if (code === "weak_password") {
    return "Essa senha é muito comum ou já apareceu em vazamentos. Escolha uma senha mais forte.";
  }
  if (code === "invalid_email") {
    return "Informe um email válido para criar sua conta.";
  }
  return fallback || "Não foi possível criar sua conta. Verifique os dados e tente novamente.";
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [trashPassword, setTrashPassword] = useState("");
  const [pixPassword, setPixPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeName.trim().length < 3) {
      toast.error("Nome da lanchonete deve ter no mínimo 3 caracteres");
      return;
    }
    if (!/^\d{4}$/.test(trashPassword)) {
      toast.error("A senha da lixeira deve ter exatamente 4 dígitos numéricos");
      return;
    }
    if (!/^\d{6}$/.test(pixPassword)) {
      toast.error("A senha do Pix deve ter exatamente 6 dígitos numéricos");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error("Informe um número de celular válido com DDD");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("signup-restaurant", {
      body: {
        email,
        password,
        storeName: storeName.trim(),
        trashPassword,
        pixPassword,
        phone: phoneDigits,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      console.error(error);
      let payload: { code?: string; error?: string } | null = data ?? null;
      const context = (error as unknown as { context?: Response }).context;
      if (!payload && context) {
        try {
          payload = await context.json();
        } catch {
          payload = null;
        }
      }

      toast.error(getSignupErrorMessage(payload?.code, payload?.error));
      setLoading(false);
      return;
    }

    setLoading(false);
    toast.success("Conta criada com sucesso! Entre com seu email e senha.");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="font-display text-2xl font-bold text-primary">🍔 MenuDigital</Link>
          <p className="mt-2 text-muted-foreground">Crie sua conta</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">Nome da Lanchonete</Label>
            <Input id="storeName" value={storeName} onChange={e => setStoreName(e.target.value)} required placeholder="Burger House" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trashPassword">Senha da Lixeira (4 dígitos)</Label>
            <Input id="trashPassword" type="text" inputMode="numeric" maxLength={4} value={trashPassword} onChange={e => setTrashPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} required placeholder="1234" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pixPassword">Senha do Pix (6 dígitos)</Label>
            <Input id="pixPassword" type="text" inputMode="numeric" maxLength={6} value={pixPassword} onChange={e => setPixPassword(e.target.value.replace(/\D/g, "").slice(0, 6))} required placeholder="123456" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Celular (com DDD)</Label>
            <Input id="phone" type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} required placeholder="11999999999" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Repetir Senha</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Repita a senha" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar Conta"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
