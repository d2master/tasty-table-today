import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, X, Send, Tag, Utensils, Bike, MapPin, Link2, Copy, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";


type OrderMode = "table" | "delivery";
type PaymentMethod = "pix" | "debito" | "credito" | "dinheiro";
type AddressMode = "manual" | "maps";

const phoneRegex = /^[\d\s()+-]{8,20}$/;

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_blocked?: boolean;
  is_open?: boolean;
  closed_message?: string;
  table_count?: number;
  service_mode?: "both" | "delivery" | "table";
  pix_enabled?: boolean;
  pix_key?: string | null;
  pix_key_type?: "cpf" | "cnpj" | "email" | "phone" | "random" | null;
  pix_recipient_name?: string | null;
  pix_city?: string | null;
  delivery_payment_methods?: string[];
}

interface TableInfo {
  table_number: number;
  is_occupied: boolean;
}

interface ActiveOrderRef {
  order_id: string;
  table_number: string;
  order_type: "table" | "delivery";
  created_at: string;
}

interface OrderStatus {
  status: string;
  payment_status: string;
  table_number: string;
  order_type: string;
  created_at: string;
  updated_at: string;
  tip_enabled?: boolean;
  tip_amount?: number;
  total?: number;
}

interface OrderItemPublic {
  product_name: string;
  quantity: number;
  price: number;
}


interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  is_promo: boolean;
  image_url: string | null;
  is_available: boolean;
  track_stock: boolean;
  stock_quantity: number;
  category_id: string;
}

const effectivePrice = (p: Product) =>
  p.is_promo && p.promo_price != null ? Number(p.promo_price) : Number(p.price);

interface CartItem {
  product: Product;
  quantity: number;
}

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orderMode, setOrderMode] = useState<OrderMode>("table");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Delivery fields
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [addressMode, setAddressMode] = useState<AddressMode>("manual");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMapsUrl, setDeliveryMapsUrl] = useState("");
  const [pixPayment, setPixPayment] = useState<{ copyPaste: string; key: string; amount: number; orderId: string } | null>(null);

  // Tables state
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Active order tracking
  const [activeOrder, setActiveOrder] = useState<ActiveOrderRef | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemPublic[]>([]);
  const [showTracker, setShowTracker] = useState(false);
  // Append mode: when set, the cart will append items to this existing order
  const [appendMode, setAppendMode] = useState<{ orderId: string; tableNumber: string } | null>(null);


  const resetCheckoutState = () => {
    setCart([]);
    setShowCart(false);
    setCustomerName("");
    setTableNumber("");
    setObservation("");
    setCustomerPhone("");
    setPaymentMethod("");
    setDeliveryAddress("");
    setDeliveryMapsUrl("");
  };

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: restRows } = await supabase
        .rpc("get_public_restaurant_by_slug", { _slug: slug });
      const rest = Array.isArray(restRows) ? restRows[0] : restRows;
      if (!rest) { setNotFound(true); setLoading(false); return; }
      setRestaurant({
        id: rest.id,
        name: rest.name,
        slug: rest.slug,
        description: rest.description,
        is_blocked: rest.is_blocked,
        is_open: (rest as { is_open?: boolean }).is_open ?? true,
        closed_message: (rest as { closed_message?: string }).closed_message ?? "",
        table_count: (rest as { table_count?: number }).table_count ?? 0,
        service_mode: ((rest as { service_mode?: "both" | "delivery" | "table" }).service_mode) ?? "both",
        pix_enabled: rest.pix_enabled,
        pix_key: null,
        pix_key_type: null,
        pix_recipient_name: rest.pix_recipient_name,
        pix_city: rest.pix_city,
        delivery_payment_methods: ((rest as { delivery_payment_methods?: string[] }).delivery_payment_methods) ?? ["pix","debito","credito","dinheiro"],
      });
      if (rest.is_blocked) { setLoading(false); return; }

      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
        supabase.from("products").select("*").eq("restaurant_id", rest.id).eq("is_available", true).order("sort_order"),
      ]);

      setCategories(catRes.data ?? []);
      // Hide products that are tracked-stock and out of stock
      const allProducts = (prodRes.data as Product[]) ?? [];
      setProducts(allProducts.filter(p => !p.track_stock || p.stock_quantity > 0));
      if (catRes.data?.length) setActiveCategory(catRes.data[0].id);
      setLoading(false);
    })();
  }, [slug]);

  // Force order mode if restaurant only accepts one type
  useEffect(() => {
    if (!restaurant?.service_mode) return;
    if (restaurant.service_mode === "delivery") setOrderMode("delivery");
    else if (restaurant.service_mode === "table") setOrderMode("table");
  }, [restaurant?.service_mode]);

  // Load active order from localStorage
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(`active_order_${slug}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveOrderRef;
        setActiveOrder(parsed);
      }
    } catch { /* ignore */ }
  }, [slug]);

  // Fetch available tables (called on mount, when cart opens, and on interval)
  const loadTables = async () => {
    if (!slug || !restaurant?.table_count) return;
    setLoadingTables(true);
    try {
      const { data, error } = await supabase.rpc("get_available_tables", { _slug: slug });
      if (!error && Array.isArray(data)) {
        setTables(data as TableInfo[]);
      }
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (restaurant?.table_count) loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.table_count, slug]);

  // Refresh tables every 10s while cart is open in table mode
  useEffect(() => {
    if (!showCart || orderMode !== "table" || !restaurant?.table_count) return;
    loadTables();
    const interval = setInterval(loadTables, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCart, orderMode, restaurant?.table_count]);

  // Poll order status + items every 5s while there's an active order
  useEffect(() => {
    if (!activeOrder) {
      setOrderStatus(null);
      setOrderItems([]);
      return;
    }
    let cancelled = false;
    const fetchAll = async () => {
      const [statusRes, itemsRes] = await Promise.all([
        supabase.rpc("get_order_status", { _order_id: activeOrder.order_id }),
        supabase.rpc("get_order_items_public", { _order_id: activeOrder.order_id }),
      ]);
      if (cancelled) return;
      if (!statusRes.error && Array.isArray(statusRes.data) && statusRes.data.length > 0) {
        setOrderStatus(statusRes.data[0] as OrderStatus);
      }
      if (!itemsRes.error && Array.isArray(itemsRes.data)) {
        setOrderItems(itemsRes.data as OrderItemPublic[]);
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeOrder]);

  const clearActiveOrder = () => {
    if (slug) localStorage.removeItem(`active_order_${slug}`);
    setActiveOrder(null);
    setOrderStatus(null);
    setOrderItems([]);
    setShowTracker(false);
    setAppendMode(null);
  };

  const startAppendMode = () => {
    if (!activeOrder) return;
    setAppendMode({ orderId: activeOrder.order_id, tableNumber: activeOrder.table_number });
    setShowTracker(false);
    setCart([]);
    toast.info("Escolha os novos itens e abra o carrinho para confirmar");
  };


  const cancelAppendMode = () => {
    setAppendMode(null);
    setCart([]);
    setShowCart(false);
    if (activeOrder) setShowTracker(true);
  };




  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      const currentQty = existing?.quantity ?? 0;
      if (product.track_stock && currentQty + 1 > product.stock_quantity) {
        toast.error("Quantidade indisponível");
        return prev;
      }
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const next = Math.max(0, c.quantity + delta);
      if (delta > 0 && c.product.track_stock && next > c.product.stock_quantity) {
        toast.error("Quantidade indisponível");
        return c;
      }
      return { ...c, quantity: next };
    }).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * effectivePrice(c.product), 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const tableSchema = z.object({
    tableNumber: z.string().trim().min(1, "Informe o número da mesa").max(20),
    customerName: z.string().trim().max(100).optional(),
  });

  const deliverySchema = z.object({
    customerName: z.string().trim().min(1, "Informe seu nome").max(100, "Nome muito longo"),
    customerPhone: z.string().trim().regex(phoneRegex, "Telefone inválido"),
    paymentMethod: z.enum(["pix", "debito", "credito", "dinheiro"], { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
    address: z.string().trim().min(5, "Informe o endereço de entrega").max(500),
  });

  const handleSubmitOrder = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (restaurant && restaurant.is_open === false) {
      toast.error("Lanchonete fechada no momento");
      return;
    }
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }


    // ===== Append mode: skip all validation, only need cart =====
    if (appendMode) {
      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("place-order", {
          body: {
            slug,
            order_type: "table",
            table_number: appendMode.tableNumber,
            items: cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
            append_to_order_id: appendMode.orderId,
          },
        });
        if (error || !data || (data as { error?: string }).error) {
          const errMsg = (data as { error?: string })?.error || (error as { message?: string })?.message || "Erro ao adicionar itens.";
          toast.error(errMsg);
          setSubmitting(false);
          return;
        }
        toast.success("Itens adicionados ao pedido! 🎉");
        setCart([]);
        setAppendMode(null);
        setShowCart(false);
        setShowTracker(true);
      } catch (err) {
        console.error("Append error:", err);
        toast.error("Erro inesperado ao adicionar itens");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let orderPayload: Record<string, unknown> = {
      restaurant_id: restaurant!.id,
      status: "pending",
      total: cartTotal,
      order_type: orderMode,
    };

    if (orderMode === "table") {
      const parsed = tableSchema.safeParse({ tableNumber, customerName });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      orderPayload = {
        ...orderPayload,
        customer_name: customerName.trim() || "Cliente",
        table_number: tableNumber.trim(),
        customer_phone: observation.trim() || null,
      };
    } else {
      const addressValue = addressMode === "manual" ? deliveryAddress : deliveryMapsUrl;
      const parsed = deliverySchema.safeParse({
        customerName,
        customerPhone,
        paymentMethod,
        address: addressValue,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      const needsPix = paymentMethod === "pix";

      if (needsPix) {
        if (!restaurant?.pix_enabled || !restaurant.pix_recipient_name || !restaurant.pix_city) {
          toast.error("A lanchonete ainda não configurou o Pix.");
          return;
        }
      }

      orderPayload = {
        ...orderPayload,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        table_number: "",
        payment_method: paymentMethod,
        delivery_address: addressMode === "manual" ? deliveryAddress.trim() : (observation.trim() ? `Obs: ${observation.trim()}` : null),
        delivery_maps_url: addressMode === "maps" ? deliveryMapsUrl.trim() : null,
      };
      if (addressMode === "manual" && observation.trim()) {
        orderPayload.delivery_address = `${deliveryAddress.trim()}\nObs: ${observation.trim()}`;
      }
    }


    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("place-order", {
        body: {
          slug,
          order_type: orderMode,
          customer_name: orderPayload.customer_name ?? "",
          customer_phone: orderPayload.customer_phone ?? "",
          table_number: orderPayload.table_number ?? "",
          payment_method: paymentMethod || undefined,
          delivery_address: orderPayload.delivery_address ?? null,
          delivery_maps_url: orderPayload.delivery_maps_url ?? null,
          items: cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
        },
      });

      if (error || !data || (data as any).error) {
        console.error("Order error:", error, data);
        const errMsg = (data as any)?.error || (error as any)?.message || "";
        if (typeof errMsg === "string" && errMsg.toLowerCase().includes("table already occupied")) {
          toast.error("Esta mesa acabou de ser ocupada. Escolha outra.");
          loadTables();
        } else if (typeof errMsg === "string" && errMsg.toLowerCase().includes("invalid table")) {
          toast.error("Mesa inválida. Atualize a lista e escolha uma disponível.");
          loadTables();
        } else {
          toast.error("Erro ao enviar pedido. Tente novamente.");
        }
        setSubmitting(false);
        return;
      }

      const result = data as { order_id: string; total: number; pix_copy_paste: string | null; pix_key: string | null };

      // Save active order to localStorage so the customer can track it
      const activeRef: ActiveOrderRef = {
        order_id: result.order_id,
        table_number: orderMode === "table" ? tableNumber.trim() : "",
        order_type: orderMode,
        created_at: new Date().toISOString(),
      };
      try {
        if (slug) localStorage.setItem(`active_order_${slug}`, JSON.stringify(activeRef));
      } catch { /* ignore */ }
      setActiveOrder(activeRef);
      setShowTracker(true);

      if (paymentMethod === "pix" && result.pix_copy_paste && result.pix_key) {
        setPixPayment({ copyPaste: result.pix_copy_paste, key: result.pix_key, amount: result.total, orderId: result.order_id });
        resetCheckoutState();
        toast.success("Pedido enviado! Agora finalize o pagamento via Pix.");
        return;
      }

      toast.success("Pedido enviado com sucesso! 🎉");
      resetCheckoutState();
    } catch (err: any) {
      console.error("Unexpected order error:", err);
      toast.error("Erro inesperado ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando cardápio...</div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lanchonete não encontrada</div>;
  if (restaurant?.is_blocked) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">Cardápio temporariamente indisponível</h1>
        <p className="text-muted-foreground">Este estabelecimento está temporariamente fora do ar. Tente novamente mais tarde.</p>
      </div>
    </div>
  );

  const filteredProducts = activeCategory ? products.filter(p => p.category_id === activeCategory) : products;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container text-center">
          <h1 className="font-display text-2xl font-bold">🍔 {restaurant?.name}</h1>
          {restaurant?.description && <p className="text-sm mt-1 opacity-90">{restaurant.description}</p>}
        </div>
      </header>

      {restaurant && restaurant.is_open === false && (
        <div className="bg-destructive/10 border-b border-destructive/30 text-destructive">
          <div className="container py-4 text-center">
            <p className="font-bold uppercase tracking-wide text-sm">Lanchonete fechada</p>
            <p className="text-sm mt-1 whitespace-pre-line text-destructive/90">
              {restaurant.closed_message || "Estamos fechados no momento. Volte em breve!"}
            </p>
            <p className="text-xs mt-2 text-muted-foreground">Você pode visualizar o cardápio, mas pedidos estão temporariamente indisponíveis.</p>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="container flex gap-2 overflow-x-auto py-3 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <main className="container py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const inCart = cart.find(c => c.product.id === product.id);
            const isPromo = product.is_promo && product.promo_price != null;
            const discountPct = isPromo
              ? Math.round((1 - Number(product.promo_price) / Number(product.price)) * 100)
              : 0;
            return (
              <motion.div
                key={product.id}
                className={`relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all ${
                  isPromo ? "ring-2 ring-primary/60 shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.45)]" : ""
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {product.image_url && (
                  <div className="relative">
                    <img src={product.image_url} alt={product.name} className="w-full h-44 object-cover" />
                    {isPromo && (
                      <>
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-display font-bold tracking-wider uppercase shadow-md">
                          <Tag className="h-3 w-3" /> PROMO
                        </span>
                        {discountPct > 0 && (
                          <span className="absolute top-2 right-2 rounded-full bg-destructive text-destructive-foreground px-2 py-1 text-[11px] font-bold shadow-md">
                            -{discountPct}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{product.name}</h3>
                    {isPromo && !product.image_url && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-display font-bold tracking-wider uppercase">
                        <Tag className="h-3 w-3" /> PROMO
                      </span>
                    )}
                  </div>
                  {product.description && <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    {isPromo ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
                        <span className="font-display font-extrabold text-xl text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="font-display font-bold text-lg text-primary">R$ {Number(product.price).toFixed(2)}</span>
                    )}
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(product.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="font-medium w-6 text-center">{inCart.quantity}</span>
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(product.id, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => addToCart(product)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        {filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum produto nesta categoria.</p>}
      </main>

      {/* Active order pill (top-right floating) */}
      {activeOrder && !showTracker && (
        <button
          type="button"
          onClick={() => setShowTracker(true)}
          className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold shadow-lg hover:opacity-90 transition"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
          </span>
          Acompanhar pedido
        </button>
      )}

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t shadow-lg z-40">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => setShowCart(true)}
            disabled={!appendMode && restaurant?.is_open === false}
          >
            <ShoppingCart className="h-5 w-5" />
            {!appendMode && restaurant?.is_open === false
              ? "Lanchonete fechada"
              : appendMode
                ? `Adicionar ao pedido (${cartCount}) — R$ ${cartTotal.toFixed(2)}`
                : `Ver Carrinho (${cartCount}) — R$ ${cartTotal.toFixed(2)}`}
          </Button>
        </div>
      )}


      {/* Order Tracker Drawer */}
      <AnimatePresence>
        {showTracker && activeOrder && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setShowTracker(false)} />
            <motion.div
              className="relative w-full max-w-lg bg-card rounded-t-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Seu pedido</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowTracker(false)}><X className="h-5 w-5" /></Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Pedido <span className="font-mono font-semibold text-foreground">#{activeOrder.order_id.slice(0, 8).toUpperCase()}</span>
                {activeOrder.order_type === "table" && activeOrder.table_number && (
                  <> · Mesa <span className="font-semibold text-foreground">{activeOrder.table_number}</span></>
                )}
              </div>

              {(() => {
                const status = orderStatus?.status ?? "pending";
                const steps = [
                  { key: "pending", label: "Pendente", desc: "Aguardando a lanchonete aceitar" },
                  { key: "preparing", label: "Em preparo", desc: "A lanchonete está preparando" },
                  { key: "ready", label: "Pronto", desc: "Seu pedido está pronto" },
                  { key: "done", label: "Finalizado", desc: "Pedido entregue / encerrado" },
                ];
                const order = ["pending", "preparing", "ready", "done"];
                const currentIdx = order.indexOf(status);
                const isCancelled = status === "cancelled";

                return (
                  <div className="space-y-3">
                    {isCancelled ? (
                      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center space-y-1">
                        <p className="font-semibold text-destructive">Pedido cancelado</p>
                        <p className="text-sm text-muted-foreground">A lanchonete cancelou este pedido.</p>
                      </div>
                    ) : (
                      <ol className="space-y-3">
                        {steps.map((s, idx) => {
                          const reached = currentIdx >= idx;
                          const isCurrent = currentIdx === idx;
                          return (
                            <li key={s.key} className="flex items-start gap-3">
                              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                reached ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                              } ${isCurrent ? "ring-2 ring-primary/30 animate-pulse" : ""}`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className={`font-semibold ${reached ? "" : "text-muted-foreground"}`}>{s.label}</p>
                                <p className="text-xs text-muted-foreground">{s.desc}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {status === "done" && (
                      <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-center text-sm">
                        ✅ A lanchonete finalizou seu pedido. Obrigado!
                      </div>
                    )}

                    {/* Items list */}
                    <div className="rounded-xl border bg-secondary/30 p-3 space-y-2">
                      <p className="text-sm font-semibold">Itens do pedido</p>
                      {orderItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Carregando itens...</p>
                      ) : (
                        <>
                          <ul className="space-y-1.5">
                            {orderItems.map((it, idx) => (
                              <li key={idx} className="flex items-start justify-between text-sm gap-2">
                                <span className="flex-1">
                                  <span className="font-semibold">{it.quantity}×</span> {it.product_name}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  R$ {(Number(it.price) * it.quantity).toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">
                              R$ {orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0).toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Add more items: only for table orders, while still active */}
                    {activeOrder.order_type === "table" &&
                      ["pending", "preparing", "ready"].includes(status) && (
                        <Button className="w-full gap-2" onClick={startAppendMode}>
                          <Plus className="h-4 w-4" /> Adicionar mais itens
                        </Button>
                      )}

                    {(status === "done" || status === "cancelled") && (
                      <Button variant="outline" className="w-full" onClick={clearActiveOrder}>
                        Fechar acompanhamento
                      </Button>
                    )}

                    {status !== "done" && status !== "cancelled" && (
                      <p className="text-xs text-muted-foreground text-center">
                        Atualizando automaticamente. Apenas a lanchonete pode finalizar o pedido.
                      </p>
                    )}

                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {(showCart || pixPayment) && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-foreground/40" onClick={() => !submitting && !pixPayment && setShowCart(false)} />
            <motion.div
              className="relative w-full max-w-lg bg-card rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">
                  {pixPayment ? "Pagamento Pix" : appendMode ? "Adicionar ao pedido" : "Seu Pedido"}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => pixPayment ? setPixPayment(null) : appendMode ? cancelAppendMode() : setShowCart(false)}><X className="h-5 w-5" /></Button>
              </div>

              {appendMode && !pixPayment && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                  <p className="font-semibold text-primary">
                    Pedido #{appendMode.orderId.slice(0, 8).toUpperCase()}
                    {appendMode.tableNumber && <> — Mesa {appendMode.tableNumber}</>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Os itens abaixo serão adicionados ao seu pedido atual. Itens já enviados não podem ser removidos.
                  </p>
                </div>
              )}


              {pixPayment ? (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-secondary/40 p-4 text-center space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total do pedido</p>
                      <p className="font-display text-3xl font-bold text-primary">R$ {pixPayment.amount.toFixed(2)}</p>
                    </div>
                    <div className="mx-auto w-fit rounded-xl border bg-white p-4">
                      <QRCodeSVG value={pixPayment.copyPaste} size={220} includeMargin level="M" />
                    </div>
                    <p className="text-xs text-muted-foreground">Pedido #{pixPayment.orderId.slice(0, 8).toUpperCase()}</p>
                  </div>

                  <div className="rounded-xl border p-4 space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Chave Pix</p>
                      <p className="font-medium break-all">{pixPayment.key}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Código copia e cola</p>
                      <p className="text-xs break-all rounded-lg bg-secondary/50 p-3">{pixPayment.copyPaste}</p>
                    </div>
                    <Button
                      className="w-full gap-2"
                      onClick={async () => {
                        await navigator.clipboard.writeText(pixPayment.copyPaste);
                        toast.success("Código Pix copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar código Pix
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">Após pagar, aguarde a confirmação da lanchonete.</p>
                </div>
              ) : <>
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">R$ {effectivePrice(item.product).toFixed(2)} un.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center font-medium">{item.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-between font-display font-bold text-lg pt-2">
                <span>Total</span>
                <span className="text-primary">R$ {cartTotal.toFixed(2)}</span>
              </div>

              {!appendMode && (<>
              {/* Order mode selector — hidden modes when restaurant restricts service */}
              {restaurant?.service_mode === "both" ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOrderMode("table")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      orderMode === "table" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                    }`}
                  >
                    <Utensils className="h-4 w-4" /> Mesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderMode("delivery")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      orderMode === "delivery" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                    }`}
                  >
                    <Bike className="h-4 w-4" /> Delivery
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 pt-2 py-2.5 rounded-lg border bg-secondary/40 text-sm font-medium">
                  {restaurant?.service_mode === "delivery" ? (
                    <><Bike className="h-4 w-4" /> Apenas Delivery</>
                  ) : (
                    <><Utensils className="h-4 w-4" /> Apenas Mesa</>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {orderMode === "table" ? (
                  <>
                    <div className="space-y-1">
                      <Label>Seu nome</Label>
                      <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="João da Silva (opcional)" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Selecione sua mesa <span className="text-destructive">*</span></Label>
                        <button
                          type="button"
                          onClick={loadTables}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                          disabled={loadingTables}
                        >
                          {loadingTables ? "Atualizando..." : "Atualizar"}
                        </button>
                      </div>
                      {!restaurant?.table_count ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground text-center">
                          A lanchonete ainda não configurou as mesas. Tente o modo Delivery ou volte mais tarde.
                        </div>
                      ) : tables.length === 0 ? (
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground text-center">
                          Carregando mesas...
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                            {tables.map(t => {
                              const selected = tableNumber === String(t.table_number);
                              const disabled = t.is_occupied && !selected;
                              return (
                                <button
                                  key={t.table_number}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setTableNumber(String(t.table_number))}
                                  className={`relative aspect-square rounded-lg border text-sm font-semibold transition-colors ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : disabled
                                        ? "bg-muted text-muted-foreground border-input cursor-not-allowed line-through"
                                        : "bg-card border-input hover:bg-secondary"
                                  }`}
                                >
                                  {t.table_number}
                                  {t.is_occupied && (
                                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1 leading-none h-4">
                                      !
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Mesas com <span className="font-semibold text-destructive">!</span> estão ocupadas e só liberam quando a lanchonete finalizar o pedido.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Observação</Label>
                      <Input value={observation} onChange={e => setObservation(e.target.value)} placeholder="Sem cebola, bem passado... (opcional)" maxLength={200} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Seu nome <span className="text-destructive">*</span></Label>
                      <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="João da Silva" maxLength={100} />
                    </div>
                    <div className="space-y-1">
                      <Label>Telefone <span className="text-destructive">*</span></Label>
                      <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={20} />
                    </div>

                    <div className="space-y-1">
                      <Label>Forma de pagamento <span className="text-destructive">*</span></Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const allowed = restaurant?.delivery_payment_methods ?? ["pix","debito","credito","dinheiro"];
                          const all: { v: PaymentMethod; l: string }[] = [
                            { v: "pix", l: "Pix" },
                            { v: "debito", l: "Débito" },
                            { v: "credito", l: "Crédito" },
                            { v: "dinheiro", l: "Dinheiro" },
                          ];
                          const opts = all.filter(o => allowed.includes(o.v));
                          if (opts.length === 0) {
                            return <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento disponível no momento.</p>;
                          }
                          return opts.map(opt => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setPaymentMethod(opt.v)}
                              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                                paymentMethod === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                              }`}
                            >
                              {opt.l}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Endereço de entrega <span className="text-destructive">*</span></Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAddressMode("manual")}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            addressMode === "manual" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5" /> Digitar endereço
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddressMode("maps")}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            addressMode === "maps" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                          }`}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link do Maps
                        </button>
                      </div>
                      {addressMode === "manual" ? (
                        <Textarea
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Rua, número, bairro, complemento, ponto de referência..."
                          maxLength={500}
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={deliveryMapsUrl}
                          onChange={e => setDeliveryMapsUrl(e.target.value)}
                          placeholder="https://maps.google.com/..."
                          maxLength={500}
                        />
                      )}
                      {addressMode === "maps" && (
                        <p className="text-xs text-muted-foreground">Abra o Google Maps, marque o local e cole o link aqui.</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label>Observação</Label>
                      <Input value={observation} onChange={e => setObservation(e.target.value)} placeholder="Sem cebola, troco para R$50... (opcional)" maxLength={200} />
                    </div>
                  </>
                )}
              </div>
              </>)}


              <Button className="w-full gap-2" size="lg" onClick={handleSubmitOrder} disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? (appendMode ? "Adicionando..." : "Enviando...") : (appendMode ? "Adicionar ao pedido" : "Finalizar Pedido")}
              </Button>

              </>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
