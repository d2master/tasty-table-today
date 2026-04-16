import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, ShieldOff, LogOut, Loader2 } from "lucide-react";

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  is_blocked: boolean;
  created_at: string;
  owner_id: string;
  owner_email: string;
}

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchRestaurants();
  }, [isAdmin]);

  const fetchRestaurants = async () => {
    setLoadingData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("get-admin-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data?.restaurants) {
        setRestaurants(res.data.restaurants);
      }
    } catch (e) {
      toast.error("Erro ao carregar dados");
    }
    setLoadingData(false);
  };

  const toggleBlock = async (restaurant: AdminRestaurant) => {
    setTogglingId(restaurant.id);
    const newBlocked = !restaurant.is_blocked;
    const { error } = await supabase
      .from("restaurants")
      .update({ is_blocked: newBlocked } as any)
      .eq("id", restaurant.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setRestaurants(prev =>
        prev.map(r => r.id === restaurant.id ? { ...r, is_blocked: newBlocked } : r)
      );
      toast.success(newBlocked ? "Lanchonete bloqueada" : "Lanchonete desbloqueada");
    }
    setTogglingId(null);
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Painel de Administração</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Lanchonetes Cadastradas</h2>
          <p className="text-sm text-muted-foreground">{restaurants.length} lanchonete(s) no total</p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email do Dono</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.owner_email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {r.is_blocked ? (
                        <Badge variant="destructive">Bloqueada</Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground">Ativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={r.is_blocked ? "outline" : "destructive"}
                        size="sm"
                        disabled={togglingId === r.id}
                        onClick={() => toggleBlock(r)}
                      >
                        {r.is_blocked ? (
                          <><ShieldOff className="h-4 w-4 mr-1" /> Desbloquear</>
                        ) : (
                          <><Shield className="h-4 w-4 mr-1" /> Bloquear</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {restaurants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma lanchonete cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
