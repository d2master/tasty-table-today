import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Shield, Lock, Unlock } from "lucide-react";

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_blocked: boolean;
  owner_email: string | null;
  owner_phone: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/admin/login");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        toast.error("Acesso negado");
        await supabase.auth.signOut();
        navigate("/admin/login");
        return;
      }
      setIsAdmin(true);
      loadRestaurants();
    })();
  }, [user, authLoading, navigate]);

  const loadRestaurants = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-restaurants");
    if (error) {
      toast.error("Erro ao carregar lanchonetes");
      setLoading(false);
      return;
    }
    setRestaurants(data.restaurants ?? []);
    setLoading(false);
  };

  const toggleBlock = async (r: AdminRestaurant) => {
    const { error } = await supabase.functions.invoke("admin-toggle-block", {
      body: { restaurant_id: r.id, is_blocked: !r.is_blocked },
    });
    if (error) {
      toast.error("Erro ao alterar status");
      return;
    }
    toast.success(r.is_blocked ? "Desbloqueada" : "Bloqueada");
    loadRestaurants();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  if (authLoading || isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Painel Administrativo</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold mb-4">Lanchonetes cadastradas ({restaurants.length})</h2>

        {loading ? (
          <p>Carregando...</p>
        ) : restaurants.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma lanchonete cadastrada.</p>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Email do dono</th>
                    <th className="text-left px-4 py-3">Cadastro</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.owner_email ?? "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        {r.is_blocked ? (
                          <Badge variant="destructive">Bloqueada</Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground">Ativa</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={r.is_blocked ? "default" : "destructive"}
                          onClick={() => toggleBlock(r)}
                        >
                          {r.is_blocked ? (
                            <><Unlock className="w-4 h-4 mr-1" /> Desbloquear</>
                          ) : (
                            <><Lock className="w-4 h-4 mr-1" /> Bloquear</>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
