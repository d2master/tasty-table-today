import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LogOut, Plus, ArrowLeft, Bell } from "lucide-react";
import { useWaiterSession, callWaiterApi } from "@/hooks/useWaiterSession";
import { playNewOrderSound, playTimerEndSound } from "@/lib/sounds";

interface TableRow { table_number: number; is_occupied: boolean; active_waiter_id: string | null; active_order_id: string | null; }
interface OrderRow { id: string; status: string; total: number; tip_enabled: boolean; tip_amount: number; waiter_id: string | null; created_at: string; updated_at: string; }
interface ItemRow { order_id: string; product_name: string; quantity: number; price: number; }
interface Category { id: string; name: string; display_order: number | null; }
interface Product { id: string; name: string; price: number; promo_price: number | null; is_promo: boolean; category_id: string | null; image_url: string | null; }

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  preparing: { label: "Em preparo", color: "bg-info text-info-foreground" },
  ready: { label: "Pronto", color: "bg-accent text-accent-foreground" },
  done: { label: "Finalizado", color: "bg-success text-success-foreground" },
  cancelled: { label: "Cancelado", color: "bg-destructive text-destructive-foreground" },
};

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function WaiterDashboard() {
  const { session, loading, logout } = useWaiterSession();
  const navigate = useNavigate();

  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, ItemRow[]>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  const [showMenu, setShowMenu] = useState(false);
  const [menu, setMenu] = useState<{ categories: Category[]; products: Product[] }>({ categories: [], products: [] });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [tipEnabled, setTipEnabled] = useState(false);

  const knownReadyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !session) navigate("/garcom/login");
  }, [session, loading, navigate]);

  const fetchTables = useCallback(async () => {
    if (!session) return;
    try {
      const data = await callWaiterApi("tables", {}, session.token);
      setTables(data.tables || []);
    } catch (e) {
      console.error(e);
    }
  }, [session]);

  const fetchOrders = useCallback(async (tableNum: number) => {
    if (!session) return;
    try {
      const data = await callWaiterApi("orders_for_table", { table_number: String(tableNum) }, session.token);
      setOrders(data.orders || []);
      setItems(data.items || {});
    } catch (e) {
      console.error(e);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchTables();
  }, [session, fetchTables, refreshTick]);

  useEffect(() => {
    if (selectedTable != null) fetchOrders(selectedTable);
  }, [selectedTable, fetchOrders, refreshTick]);

  // Realtime updates on orders for this restaurant
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`waiter-orders-${session.waiter.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${session.waiter.restaurant_id}` },
        (payload) => {
          const row = (payload.new || payload.old) as { waiter_id?: string; status?: string; id?: string } | null;
          if (!row) return;
          setRefreshTick(t => t + 1);
          if (payload.eventType !== "DELETE" && row.waiter_id === session.waiter.id && row.status === "ready" && row.id && !knownReadyRef.current.has(row.id)) {
            knownReadyRef.current.add(row.id);
            playNewOrderSound();
            toast.success("Um pedido seu está pronto!");
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const myTables = useMemo(() => tables.filter(t => t.active_waiter_id === session?.waiter.id), [tables, session]);
  const freeTables = useMemo(() => tables.filter(t => !t.is_occupied), [tables]);
  const otherTables = useMemo(() => tables.filter(t => t.is_occupied && t.active_waiter_id !== session?.waiter.id), [tables, session]);

  const openMenu = async () => {
    if (!session) return;
    try {
      const data = await callWaiterApi("menu", {}, session.token);
      setMenu(data);
      setCart({});
      setTipEnabled(false);
      setShowMenu(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar cardápio");
    }
  };

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [pid, qty]) => {
      const p = menu.products.find(x => x.id === pid);
      if (!p) return sum;
      const price = p.is_promo && p.promo_price != null ? Number(p.promo_price) : Number(p.price);
      return sum + price * qty;
    }, 0);
  }, [cart, menu]);

  const placeOrder = async () => {
    if (!session || selectedTable == null) return;
    const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (cartItems.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setPlacing(true);
    try {
      const activeOrder = orders.find(o => ["pending","preparing","ready"].includes(o.status));
      await callWaiterApi("place_order", {
        table_number: String(selectedTable),
        items: cartItems,
        append_to_order_id: activeOrder?.id,
        tip_enabled: tipEnabled,
      }, session.token);
      toast.success(activeOrder ? "Itens adicionados à mesa" : "Pedido criado");
      setShowMenu(false);
      setRefreshTick(t => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao lançar pedido");
    } finally {
      setPlacing(false);
    }
  };

  const changeStatus = async (orderId: string, status: string) => {
    if (!session) return;
    try {
      await callWaiterApi("update_status", { order_id: orderId, status }, session.token);
      setRefreshTick(t => t + 1);
      if (status === "done") playTimerEndSound();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  };

  if (loading || !session) return null;

  // ==== MENU (place order) view ====
  if (showMenu) {
    const grouped = menu.categories.map(c => ({ ...c, products: menu.products.filter(p => p.category_id === c.id) }));
    const uncat = menu.products.filter(p => !p.category_id);
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card">
          <div className="container flex items-center gap-2 h-14">
            <Button size="sm" variant="ghost" onClick={() => setShowMenu(false)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <div className="ml-auto text-sm text-muted-foreground">Mesa {selectedTable}</div>
          </div>
        </header>
        <main className="container py-4 pb-40 space-y-4">
          {[...grouped, ...(uncat.length ? [{ id: "uncat", name: "Outros", display_order: 999, products: uncat }] : [])].map(cat => (
            cat.products.length > 0 && (
              <section key={cat.id} className="space-y-2">
                <h2 className="font-display text-lg font-bold">{cat.name}</h2>
                <div className="grid gap-2">
                  {cat.products.map(p => {
                    const price = p.is_promo && p.promo_price != null ? Number(p.promo_price) : Number(p.price);
                    const qty = cart[p.id] || 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-sm text-primary">{currency(price)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setCart(c => ({ ...c, [p.id]: Math.max(0, (c[p.id]||0) - 1) }))} disabled={qty === 0}>-</Button>
                          <span className="w-6 text-center">{qty}</span>
                          <Button size="sm" variant="outline" onClick={() => setCart(c => ({ ...c, [p.id]: (c[p.id]||0) + 1 }))}>+</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )
          ))}
        </main>
        <div className="fixed bottom-0 inset-x-0 border-t bg-card p-3 space-y-2">
          <div className="container space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tipEnabled} onChange={e => setTipEnabled(e.target.checked)} />
              Cliente quer pagar 10% do garçom
            </label>
            <div className="flex items-center justify-between">
              <span className="font-medium">Total: {currency(cartTotal)}</span>
              <Button onClick={placeOrder} disabled={placing || Object.values(cart).every(q => !q)}>
                {placing ? "Enviando..." : "Lançar pedido"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== TABLE DETAIL view ====
  if (selectedTable != null) {
    const activeOrder = orders.find(o => ["pending","preparing","ready"].includes(o.status));
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card">
          <div className="container flex items-center gap-2 h-14">
            <Button size="sm" variant="ghost" onClick={() => setSelectedTable(null)}><ArrowLeft className="h-4 w-4 mr-1" /> Mesas</Button>
            <h1 className="font-display text-lg font-bold">Mesa {selectedTable}</h1>
            <Button size="sm" className="ml-auto" onClick={openMenu}><Plus className="h-4 w-4 mr-1" /> {activeOrder ? "Adicionar" : "Novo pedido"}</Button>
          </div>
        </header>
        <main className="container py-4 space-y-3">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido nesta mesa ainda.</p>}
          {orders.map(o => (
            <div key={o.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={statusLabels[o.status]?.color}>{statusLabels[o.status]?.label || o.status}</Badge>
                <span className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <ul className="text-sm space-y-1">
                {(items[o.id] || []).map((it, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{it.quantity}× {it.product_name}</span>
                    <span>{currency(Number(it.price) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Total {o.tip_enabled ? `(gorjeta ${currency(Number(o.tip_amount))})` : ""}</span>
                <strong>{currency(Number(o.total))}</strong>
              </div>
              {["pending","preparing","ready"].includes(o.status) && (
                <div className="flex flex-wrap gap-2">
                  {o.status === "pending" && <Button size="sm" variant="outline" onClick={() => changeStatus(o.id, "preparing")}>Em preparo</Button>}
                  {(o.status === "pending" || o.status === "preparing") && <Button size="sm" variant="outline" onClick={() => changeStatus(o.id, "ready")}>Pronto</Button>}
                  <Button size="sm" onClick={() => changeStatus(o.id, "done")}>Finalizar</Button>
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    );
  }

  // ==== TABLES LIST view ====
  const renderTable = (t: TableRow, kind: "mine" | "free" | "other") => (
    <button
      key={t.table_number}
      type="button"
      onClick={() => (kind === "other" ? toast.error("Mesa atendida por outro garçom") : setSelectedTable(t.table_number))}
      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all ${
        kind === "mine" ? "border-primary bg-primary/10 text-primary"
        : kind === "free" ? "border-border bg-card hover:border-primary hover:bg-primary/5"
        : "border-muted bg-muted/40 text-muted-foreground cursor-not-allowed"
      }`}
    >
      <span className="text-xl font-bold">{t.table_number}</span>
      <span className="text-[10px] mt-1">
        {kind === "mine" ? "Minha mesa" : kind === "free" ? "Livre" : "Ocupada"}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex items-center gap-2 h-14">
          <span className="font-display text-lg font-bold text-primary">🍔 {session.waiter.restaurant_name}</span>
          <span className="text-sm text-muted-foreground ml-2">— {session.waiter.name}</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRefreshTick(t => t + 1)}><Bell className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await logout(); navigate("/garcom/login"); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="container py-4 space-y-6">
        {myTables.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-bold mb-2">Minhas mesas ({myTables.length})</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {myTables.map(t => renderTable(t, "mine"))}
            </div>
          </section>
        )}
        <section>
          <h2 className="font-display text-lg font-bold mb-2">Mesas livres ({freeTables.length})</h2>
          {freeTables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mesa livre.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {freeTables.map(t => renderTable(t, "free"))}
            </div>
          )}
        </section>
        {otherTables.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-bold mb-2 text-muted-foreground">Ocupadas por outros ({otherTables.length})</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 opacity-60">
              {otherTables.map(t => renderTable(t, "other"))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
