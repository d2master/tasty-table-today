import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWaiterSession } from "@/hooks/useWaiterSession";

export default function WaiterLogin() {
  const [slug, setSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useWaiterSession();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(slug.trim().toLowerCase(), username.trim().toLowerCase(), password);
      navigate("/garcom");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="font-display text-2xl font-bold text-primary">🍔 Painel do Garçom</Link>
          <p className="mt-2 text-muted-foreground">Entre com o usuário fornecido pela lanchonete</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Lanchonete</Label>
            <Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} required placeholder="ex: minha-lanchonete" />
            <p className="text-xs text-muted-foreground">Identificador da lanchonete (mesmo do link do cardápio).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="garcom1" autoCapitalize="none" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Você é dono da lanchonete? <Link to="/login" className="text-primary hover:underline">Entrar como lanchonete</Link>
        </p>
      </div>
    </div>
  );
}
