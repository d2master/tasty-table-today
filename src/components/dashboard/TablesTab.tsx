import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Utensils } from "lucide-react";

interface TableOrder {
  id: string;
  table_number: string;
  status: string;
  customer_name: string | null;
  waiter_id: string | null;
  total: number;
  tip_amount: number | null;
  tip_enabled: boolean | null;
  created_at: string;
}

interface Item {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

const ACTIVE = ["pending", "preparing", "ready"];
const RANK: Record<string, number> = { pending: 1, preparing: 2, ready: 3 };

const tableStatus: Record<string, { label: string; card: string; badge: string }> = {
  pending: {
    label: "Pendente",
    card: "bg-warning/15 border-warning text-foreground hover:bg-warning/25",
    badge: "bg-warning text-warning-foreground",
  },
  preparing: {
    label: "Em preparo",
    card: "bg-info/15 border-info text-foreground hover:bg-info/25",
    badge: "bg-info text-info-foreground",
  },
  ready: {
    label: "Ocupada",
    card: "bg-accent/20 border-accent text-foreground hover:bg-accent/30",
    badge: "bg-accent text-accent-foreground",
  },
  free: {
    label: "Livre",
    card: "bg-success/10 border-success/40 text-foreground hover:bg-success/20",
    badge: "bg-success text-success-foreground",
  },
};

const currency = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function TablesTab({ restaurantId, tableCount }: { restaurantId: string; tableCount: number }) {
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [waiters, setWaiters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const [{ data: o }, { data: w }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, table_number, status, customer_name, waiter_id, total, tip_amount, tip_enabled, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "table")
        .is("deleted_at", null)
        .in("status", ACTIVE)
        .order("created_at", { ascending: true }),
      supabase.from("waiters").select("id, name").eq("restaurant_id", restaurantId),
    ]);
    setOrders((o || []) as TableOrder[]);
    const map: Record<string, string> = {};
    (w || []).forEach((x: { id: string; name: string }) => { map[x.id] = x.name; });
    setWaiters(map);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`tables-map-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, load]);

  // Load items of the selected table's active orders
  useEffect(() => {
    if (!selected) { setItems([]); return; }
    const ids = orders.filter(o => o.table_number === selected).map(o => o.id);
    if (ids.length === 0) { setItems([]); return; }
    let cancelled = false;
    supabase
      .from("order_items")
      .select("id, order_id, product_name, quantity, price")
      .in("order_id", ids)
      .then(({ data }) => { if (!cancelled) setItems((data || []) as Item[]); });
    return () => { cancelled = true; };
  }, [selected, orders]);

  const byTable = useMemo(() => {
    const map = new Map<string, TableOrder[]>();
    orders.forEach(o => {
      const key = String(o.table_number || "").trim();
      if (!key) return;
      map.set(key, [...(map.get(key) || []), o]);
    });
    return map;
  }, [orders]);

  const allTables = useMemo(() => {
    const nums = Array.from({ length: Math.max(0, tableCount) }, (_, i) => String(i + 1));
    // Include occupied tables that are outside the configured range
    byTable.forEach((_, k) => { if (!nums.includes(k)) nums.push(k); });
    return nums.sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  }, [tableCount, byTable]);

  const occupied = allTables.filter(t => byTable.has(t));
  const free = allTables.filter(t => !byTable.has(t));

  const statusOf = (t: string) => {
    const list = byTable.get(t);
    if (!list || list.length === 0) return "free";
    return list.reduce((acc, o) => (RANK[o.status] > RANK[acc] ? o.status : acc), list[0].status);
  };

  const selectedOrders = selected ? (byTable.get(selected) || []) : [];

  const TableCard = ({ t }: { t: string }) => {
    const st = statusOf(t);
    const cfg = tableStatus[st] ?? tableStatus.free;
    const list = byTable.get(t) || [];
    const total = list.reduce((s, o) => s + Number(o.total || 0), 0);
    const waiterName = list.map(o => (o.waiter_id ? waiters[o.waiter_id] : null)).find(Boolean);
    const customer = list.map(o => o.customer_name).find(n => n && n.trim());
    const openedAt = list[0]?.created_at;

    return (
      <button
        type="button"
        onClick={() => setSelected(t)}
        className={`aspect-square rounded-xl border-2 p-2 text-left transition-colors flex flex-col ${cfg.card}`}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="font-display text-2xl font-bold leading-none">{t}</span>
          {list.length > 1 && <span className="text-[10px] rounded bg-background/70 px-1">{list.length}x</span>}
        </div>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{cfg.label}</span>
        <div className="mt-auto space-y-0.5 overflow-hidden">
          {customer && (
            <p className="truncate text-[11px] flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" /> {customer}
            </p>
          )}
          {waiterName && (
            <p className="truncate text-[11px] flex items-center gap-1">
              <Utensils className="h-3 w-3 shrink-0" /> {waiterName}
            </p>
          )}
          {list.length > 0 && (
            <p className="text-[11px] font-medium">
              {currency(total)}
              {openedAt && (
                <span className="ml-1 text-muted-foreground">
                  {new Date(openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-bold">Mapa das mesas</h2>
        <p className="text-sm text-muted-foreground">
          Toque em uma mesa para ver o cliente, o garçom e os pedidos. A mesa fica livre automaticamente quando o pedido é
          <strong> Finalizado</strong> ou <strong>Cancelado</strong> — aqui no painel ou no "Fechar conta" do garçom.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(["pending", "preparing", "ready", "free"] as const).map(k => (
            <span key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`h-3 w-3 rounded-sm border-2 ${tableStatus[k].card}`} /> {tableStatus[k].label}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : allTables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mesa configurada. Defina a quantidade abaixo.</p>
      ) : (
        <>
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-display text-lg font-bold">Ocupadas ({occupied.length})</h3>
            {occupied.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mesa ocupada agora.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {occupied.map(t => <TableCard key={t} t={t} />)}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-display text-lg font-bold">Livres ({free.length})</h3>
            {free.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as mesas estão ocupadas.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {free.map(t => <TableCard key={t} t={t} />)}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mesa {selected}</DialogTitle>
          </DialogHeader>
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mesa livre — nenhum pedido em andamento.</p>
          ) : (
            <div className="space-y-4">
              {selectedOrders.map(o => {
                const cfg = tableStatus[o.status] ?? tableStatus.free;
                const oItems = items.filter(i => i.order_id === o.id);
                return (
                  <div key={o.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium">{o.customer_name?.trim() || "Cliente não informado"}</p>
                        <p className="text-xs text-muted-foreground">
                          Garçom: {o.waiter_id ? waiters[o.waiter_id] || "—" : "sem garçom"} •{" "}
                          {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge className={cfg.badge}>{cfg.label}</Badge>
                    </div>
                    <div className="space-y-1">
                      {oItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem itens registrados.</p>
                      ) : oItems.map(i => (
                        <div key={i.id} className="flex justify-between text-sm">
                          <span>{i.quantity}x {i.product_name}</span>
                          <span className="text-muted-foreground">{currency(i.price * i.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    {o.tip_enabled && Number(o.tip_amount) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Gorjeta 10%</span>
                        <span>{currency(Number(o.tip_amount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                      <span>Total</span>
                      <span>{currency(Number(o.total))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
