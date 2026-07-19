import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateSlug } from "@/lib/supabase-helpers";

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
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      console.error(authError);
      toast.error("Não foi possível criar sua conta. Verifique os dados e tente novamente.");
      setLoading(false);
      return;
    }

    if (authData.user) {
      const slug = generateSlug(storeName) + "-" + Date.now().toString(36).slice(-4);
      const { error: restaurantError } = await supabase.from("restaurants").insert({
        name: storeName,
        slug,
        owner_id: authData.user.id,
        trash_password: trashPassword,
        pix_password: pixPassword,
      });

      if (restaurantError) {
        console.error(restaurantError);
        toast.error("Não foi possível criar sua lanchonete. Tente novamente.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast.success("Conta criada! Verifique seu email para confirmar.");
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
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
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
