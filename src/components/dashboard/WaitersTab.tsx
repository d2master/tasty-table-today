import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, KeyRound, Trash2, Pencil } from "lucide-react";

interface Waiter { id: string; username: string; name: string; is_active: boolean; created_at: string; }
interface ActiveTable { waiter_id: string; waiter_name: string; table_number: string; order_id: string; status: string; total: number; created_at: string; }
interface HistoryRow { waiter_id: string; waiter_name: string; orders_count: number; total_sales: number; total_tips: number; }

const currency = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function WaitersTab({ restaurantId }: { restaurantId: string }) {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [active, setActive] = useState<ActiveTable[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "" });

  const [editWaiter, setEditWaiter] = useState<Waiter | null>(null);
  const [editName, setEditName] = useState("");

  const [resetWaiter, setResetWaiter] = useState<Waiter | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState<string>(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: w }, { data: a }, { data: h }] = await Promise.all([
      supabase.from("waiters").select("id, username, name, is_active, created_at").eq("restaurant_id", restaurantId).order("name"),
      supabase.rpc("waiter_active_tables", { _restaurant_id: restaurantId }),
      supabase.rpc("waiter_history", {
        _restaurant_id: restaurantId,
        _from: `${from}T00:00:00`,
        _to: `${to}T23:59:59`,
      }),
    ]);
    setWaiters((w || []) as Waiter[]);
    setActive((a || []) as ActiveTable[]);
    setHistory((h || []) as HistoryRow[]);
    setLoading(false);
  }, [restaurantId, from, to]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`waiters-tab-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, loadAll]);

  const handleCreate = async () => {
    if (form.username.trim().length < 3) return toast.error("Usuário: mínimo 3 caracteres");
    if (form.password.length < 4) return toast.error("Senha: mínimo 4 caracteres");
    if (form.name.trim().length < 1) return toast.error("Informe o nome");
    const { error } = await supabase.rpc("waiter_create", {
      _restaurant_id: restaurantId,
      _username: form.username,
      _password: form.password,
      _name: form.name,
    });
    if (error) return toast.error(error.message);
    toast.success("Garçom criado");
    setShowForm(false);
    setForm({ username: "", name: "", password: "" });
    loadAll();
  };

  const handleToggleActive = async (w: Waiter) => {
    const { error } = await supabase.rpc("waiter_update", { _waiter_id: w.id, _name: w.name, _is_active: !w.is_active });
    if (error) return toast.error(error.message);
    loadAll();
  };

  const handleEdit = async () => {
    if (!editWaiter) return;
    const { error } = await supabase.rpc("waiter_update", { _waiter_id: editWaiter.id, _name: editName, _is_active: editWaiter.is_active });
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEditWaiter(null);
    loadAll();
  };

  const handleReset = async () => {
    if (!resetWaiter) return;
    if (newPassword.length < 4) return toast.error("Senha muito curta");
    const { error } = await supabase.rpc("waiter_reset_password", { _waiter_id: resetWaiter.id, _new_password: newPassword });
    if (error) return toast.error(error.message);
    toast.success("Senha redefinida");
    setResetWaiter(null);
    setNewPassword("");
  };

  const handleDelete = async (w: Waiter) => {
    if (!confirm(`Remover garçom "${w.name}"? Os pedidos antigos ficarão sem garçom vinculado.`)) return;
    const { error } = await supabase.rpc("waiter_delete", { _waiter_id: w.id });
    if (error) return toast.error(error.message);
    toast.success("Garçom removido");
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold">Garçons</h2>
          <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="h-4 w-4 mr-1" /> Novo garçom</Button>
        </div>
        {showForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-3 rounded-lg bg-muted/40">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="João" />
            </div>
            <div>
              <Label className="text-xs">Usuário</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, "") }))} placeholder="joao" />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="mín. 4 caracteres" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleCreate}>Criar</Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-3">O garçom entra em <strong>/garcom/login</strong> com o usuário e senha que você criar.</p>
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : waiters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum garçom cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {waiters.map(w => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{w.name} <span className="text-xs text-muted-foreground">@{w.username}</span></div>
                  <div className="text-xs text-muted-foreground">Mesas ativas: {active.filter(a => a.waiter_id === w.id).length}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Switch checked={w.is_active} onCheckedChange={() => handleToggleActive(w)} />
                    <span className="text-xs">{w.is_active ? "Ativo" : "Inativo"}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditWaiter(w); setEditName(w.name); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setResetWaiter(w)}><KeyRound className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-display text-xl font-bold mb-3">Mesas em atendimento agora ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento no momento.</p>
        ) : (
          <div className="grid gap-2">
            {active.map(a => (
              <div key={a.order_id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Mesa {a.table_number} • {a.waiter_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {currency(Number(a.total))}
                  </div>
                </div>
                <Badge>{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-display text-xl font-bold mb-3">Histórico por garçom</h2>
        <div className="flex flex-wrap gap-2 items-end mb-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={loadAll}>Atualizar</Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Garçom</th><th>Pedidos</th><th>Vendas</th><th>Gorjetas</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.waiter_id} className="border-t">
                    <td className="py-2 font-medium">{h.waiter_name}</td>
                    <td>{h.orders_count}</td>
                    <td>{currency(Number(h.total_sales))}</td>
                    <td>{currency(Number(h.total_tips))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editWaiter} onOpenChange={o => !o && setEditWaiter(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar garçom</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWaiter(null)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetWaiter} onOpenChange={o => !o && setResetWaiter(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha — {resetWaiter?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="mín. 4 caracteres" />
            <p className="text-xs text-muted-foreground">Sessões ativas do garçom serão encerradas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetWaiter(null)}>Cancelar</Button>
            <Button onClick={handleReset}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
