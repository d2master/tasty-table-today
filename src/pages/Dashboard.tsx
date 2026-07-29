import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant, type PixKeyType } from "@/hooks/useRestaurant";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { uploadProductImage } from "@/lib/supabase-helpers";
import { playNewOrderSound, playTimerEndSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Plus, Pencil, Trash2, ExternalLink, Package, FolderOpen, ShoppingBag, Copy, QrCode, Download, Timer, RotateCcw, Armchair, Power, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import type { OrderItem } from "@/hooks/useOrders";
import { z } from "zod";
import WaitersTab from "@/components/dashboard/WaitersTab";

type Tab = "orders" | "orders-old" | "trash" | "products" | "categories" | "pix" | "tables" | "shift" | "waiters";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  preparing: { label: "Em Preparo", color: "bg-info text-info-foreground" },
  ready: { label: "Pronto", color: "bg-accent text-accent-foreground" },
  done: { label: "Finalizado", color: "bg-success text-success-foreground" },
  cancelled: { label: "Cancelado", color: "bg-destructive text-destructive-foreground" },
};

const pixStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-secondary text-secondary-foreground" },
  awaiting_pix: { label: "Aguardando Pix", color: "bg-warning text-warning-foreground" },
  paid: { label: "Pago", color: "bg-success text-success-foreground" },
  failed: { label: "Falhou", color: "bg-destructive text-destructive-foreground" },
};

const pixSchema = z.object({
  pix_enabled: z.boolean(),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]).nullable(),
  pix_key: z.string().trim().nullable(),
  pix_recipient_name: z.string().trim().nullable(),
  pix_city: z.string().trim().nullable(),
}).superRefine((value, ctx) => {
  if (!value.pix_enabled) return;

  if (!value.pix_key_type) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pix_key_type"], message: "Selecione o tipo da chave Pix" });
  }
  if (!value.pix_key) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pix_key"], message: "Informe a chave Pix" });
  }
  if (!value.pix_recipient_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pix_recipient_name"], message: "Informe o nome do recebedor" });
  }
  if (!value.pix_city) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pix_city"], message: "Informe a cidade" });
  }
});

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { restaurant, isLoading: restLoading, error: restError, updateTrashPassword, updatePixSettings, setPixPassword, updateTableCount, updateOpenStatus, updateServiceMode, updateDeliveryPaymentMethods } = useRestaurant();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories(restaurant?.id);
  const { products, createProduct, updateProduct, deleteProduct } = useProducts(restaurant?.id);
  const { orders, trashOrders, updateOrderStatus, softDeleteOrder, restoreOrder, markOrderAsPaid, getOrderItems } = useOrders(restaurant?.id);

  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", promo_price: "", is_promo: false, category_id: "", is_available: true, track_stock: false, stock_quantity: "" });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Order items expand
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Timer state
  const [timers, setTimers] = useState<Record<string, { total: number; remaining: number }>>({});
  const [timerInput, setTimerInput] = useState<Record<string, string>>({});

  // Trash password dialog
  const [deletePasswordDialog, setDeletePasswordDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [deletePassword, setDeletePassword] = useState("");

  // Reset trash password dialog
  const [resetTrashDialog, setResetTrashDialog] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [newTrashPassword, setNewTrashPassword] = useState("");
  const [resetStep, setResetStep] = useState<"verify" | "newpass">("verify");
  const [verifying, setVerifying] = useState(false);

  // Reset Pix password dialog
  const [resetPixDialog, setResetPixDialog] = useState(false);
  const [pixAccountPassword, setPixAccountPassword] = useState("");
  const [newPixPassword, setNewPixPassword] = useState("");
  const [resetPixStep, setResetPixStep] = useState<"verify" | "newpass">("verify");
  const [verifyingPix, setVerifyingPix] = useState(false);

  // Confirm Pix change dialog (asks current 6-digit PIN before saving)
  const [confirmPixDialog, setConfirmPixDialog] = useState(false);
  const [pixConfirmPassword, setPixConfirmPassword] = useState("");

  const [pixForm, setPixForm] = useState({
    pix_enabled: false,
    pix_key_type: null as PixKeyType | null,
    pix_key: "",
    pix_recipient_name: "",
    pix_city: "",
  });

  // Tables config
  const [tableCountInput, setTableCountInput] = useState("");
  const [savingTableCount, setSavingTableCount] = useState(false);
  const [closedMessageInput, setClosedMessageInput] = useState("");
  const [savingShift, setSavingShift] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);

  // Track order count for new-order sound
  const prevOrderCountRef = useRef<number | null>(null);

  // Detect new orders and play sound
  useEffect(() => {
    const pendingCount = orders.filter(o => o.status === "pending").length;
    if (prevOrderCountRef.current !== null && pendingCount > prevOrderCountRef.current) {
      playNewOrderSound();
      toast.info("🔔 Novo pedido recebido!");
    }
    prevOrderCountRef.current = pendingCount;
  }, [orders]);

  // Timer countdown interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id].remaining > 0) {
            next[id] = { ...next[id], remaining: next[id].remaining - 1 };
            changed = true;
            if (next[id].remaining === 0) {
              playTimerEndSound();
              toast.warning(`⏰ Tempo do pedido esgotou!`);
            }
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!restaurant) return;

    setPixForm({
      pix_enabled: Boolean((restaurant as any).pix_enabled),
      pix_key_type: ((restaurant as any).pix_key_type as PixKeyType | null) ?? null,
      pix_key: (restaurant as any).pix_key ?? "",
      pix_recipient_name: (restaurant as any).pix_recipient_name ?? "",
      pix_city: (restaurant as any).pix_city ?? "",
    });
    setTableCountInput(String((restaurant as any).table_count ?? 0));
    setClosedMessageInput((restaurant as any).closed_message ?? "");
  }, [restaurant]);

  if (authLoading || !user || restLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 gap-3">
        <p className="text-muted-foreground">Nenhuma lanchonete encontrada.</p>
        <p className="text-xs text-muted-foreground">user.id: {user?.id ?? "(sem usuário)"}</p>
        {restError && (
          <pre className="text-xs text-destructive max-w-full overflow-auto whitespace-pre-wrap border border-destructive/30 rounded p-3 bg-destructive/5">
            {`Erro: ${restError.message}\n${(restError as any)?.code ? `Código: ${(restError as any).code}\n` : ""}${(restError as any)?.details ? `Detalhes: ${(restError as any).details}\n` : ""}${(restError as any)?.hint ? `Hint: ${(restError as any).hint}` : ""}`}
          </pre>
        )}
        <Button variant="outline" onClick={async () => { await signOut(); navigate("/login"); }}>Sair</Button>
      </div>
    );
  }

  if (restaurant.is_blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold">Conta bloqueada</h1>
          <p className="text-muted-foreground">Sua lanchonete foi bloqueada pela administração da plataforma. Entre em contato com o suporte.</p>
          <Button variant="outline" onClick={async () => { await signOut(); navigate("/login"); }}>Sair</Button>
        </div>
      </div>
    );
  }

  const menuUrl = `${window.location.origin}/cardapio/${restaurant.slug}`;
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await createCategory.mutateAsync({ name: newCatName.trim() });
    setNewCatName("");
    toast.success("Categoria criada!");
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editCatName.trim()) return;
    await updateCategory.mutateAsync({ id, name: editCatName.trim() });
    setEditingCat(null);
    toast.success("Categoria atualizada!");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Excluir categoria e todos seus produtos?")) return;
    await deleteCategory.mutateAsync(id);
    toast.success("Categoria excluída!");
  };

  const resetProductForm = () => {
    setProductForm({ name: "", description: "", price: "", promo_price: "", is_promo: false, category_id: "", is_available: true, track_stock: false, stock_quantity: "" });
    setProductImage(null);
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.category_id || !productForm.price) {
      toast.error("Preencha nome, categoria e preço");
      return;
    }
    const promoVal = productForm.is_promo && productForm.promo_price ? parseFloat(productForm.promo_price) : null;
    if (productForm.is_promo) {
      if (!promoVal || promoVal <= 0) { toast.error("Informe um preço promocional válido"); return; }
      if (promoVal >= parseFloat(productForm.price)) { toast.error("O preço promocional deve ser menor que o preço original"); return; }
    }
    const stockQty = productForm.track_stock ? parseInt(productForm.stock_quantity || "0", 10) : 0;
    if (productForm.track_stock && (!Number.isInteger(stockQty) || stockQty < 0)) {
      toast.error("Quantidade em estoque inválida"); return;
    }
    setSavingProduct(true);
    try {
      let image_url: string | null = null;
      if (productImage) {
        image_url = await uploadProductImage(productImage, restaurant.id);
      }

      if (editingProduct) {
        await updateProduct.mutateAsync({
          id: editingProduct,
          name: productForm.name,
          description: productForm.description || null,
          price: parseFloat(productForm.price),
          promo_price: promoVal,
          is_promo: productForm.is_promo,
          category_id: productForm.category_id,
          is_available: productForm.is_available,
          track_stock: productForm.track_stock,
          stock_quantity: stockQty,
          ...(image_url ? { image_url } : {}),
        });
        toast.success("Produto atualizado!");
      } else {
        await createProduct.mutateAsync({
          name: productForm.name,
          description: productForm.description || null,
          price: parseFloat(productForm.price),
          promo_price: promoVal,
          is_promo: productForm.is_promo,
          category_id: productForm.category_id,
          is_available: productForm.is_available,
          track_stock: productForm.track_stock,
          stock_quantity: stockQty,
          image_url,
          restaurant_id: restaurant.id,
          sort_order: 0,
        });
        toast.success("Produto criado!");
      }
      resetProductForm();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSavingProduct(false);
  };

  const startEditProduct = (p: any) => {
    setEditingProduct(p.id);
    setProductForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      promo_price: p.promo_price != null ? String(p.promo_price) : "",
      is_promo: !!p.is_promo,
      category_id: p.category_id,
      is_available: p.is_available,
      track_stock: !!p.track_stock,
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : "",
    });
    setShowProductForm(true);
  };

  const handleExpandOrder = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    const items = await getOrderItems(orderId);
    setOrderItems(items);
    setExpandedOrder(orderId);
  };

  const handleSoftDelete = async (orderId: string) => {
    await softDeleteOrder.mutateAsync(orderId);
    toast.success("Pedido movido para a lixeira!");
  };

  const handleRestore = async (orderId: string) => {
    await restoreOrder.mutateAsync(orderId);
    toast.success("Pedido restaurado!");
  };

  const handlePermanentDelete = async () => {
    if (!deletePasswordDialog.orderId) return;
    // Server-side verification: the RPC validates the trash password using
    // the service-definer function and only deletes if it matches.
    const { error } = await supabase.rpc("permanent_delete_order_with_password", {
      _order_id: deletePasswordDialog.orderId,
      _password: deletePassword,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("invalid password")) {
        toast.error("Senha incorreta!");
      } else if (msg.includes("not configured")) {
        toast.error("Senha da lixeira não configurada.");
      } else {
        toast.error("Não foi possível excluir o pedido.");
      }
      return;
    }
    toast.success("Pedido excluído permanentemente!");
    setDeletePasswordDialog({ open: false, orderId: null });
    setDeletePassword("");
  };

  const handleVerifyAccountPassword = async () => {
    if (!user?.email) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: accountPassword });
      if (error) {
        toast.error("Senha da conta incorreta!");
        return;
      }
      setResetStep("newpass");
    } catch {
      toast.error("Erro ao verificar senha.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResetTrashPassword = async () => {
    try {
      await updateTrashPassword.mutateAsync(newTrashPassword);
      toast.success("Senha da lixeira redefinida com sucesso!");
      setResetTrashDialog(false);
      setAccountPassword("");
      setNewTrashPassword("");
      setResetStep("verify");
    } catch {
      toast.error("Erro ao redefinir senha.");
    }
  };

  const handleSaveTableCount = async () => {
    const n = parseInt(tableCountInput, 10);
    if (!Number.isInteger(n) || n < 0 || n > 500) {
      toast.error("Informe um número entre 0 e 500.");
      return;
    }
    setSavingTableCount(true);
    try {
      await updateTableCount.mutateAsync(n);
      toast.success("Quantidade de mesas atualizada!");
    } catch {
      toast.error("Erro ao salvar quantidade de mesas.");
    } finally {
      setSavingTableCount(false);
    }
  };

  const handleToggleShift = async (open: boolean) => {
    if (!open) {
      // Closing shift requires choosing what to do with pending orders
      setCloseShiftDialog(true);
      return;
    }
    setSavingShift(true);
    try {
      await updateOpenStatus.mutateAsync({ is_open: true, closed_message: closedMessageInput });
      toast.success("Lanchonete aberta!");
    } catch {
      toast.error("Erro ao atualizar expediente.");
    } finally {
      setSavingShift(false);
    }
  };

  const handleConfirmCloseShift = async (cancelPending: boolean) => {
    setSavingShift(true);
    try {
      if (cancelPending && restaurant) {
        const { error: cancelErr } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("restaurant_id", restaurant.id)
          .is("deleted_at", null)
          .in("status", ["pending", "preparing", "ready"]);
        if (cancelErr) throw cancelErr;
      }
      await updateOpenStatus.mutateAsync({ is_open: false, closed_message: closedMessageInput });
      setCloseShiftDialog(false);
      toast.success(cancelPending ? "Expediente encerrado e pedidos pendentes cancelados." : "Expediente encerrado.");
    } catch {
      toast.error("Erro ao encerrar expediente.");
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveClosedMessage = async () => {
    setSavingShift(true);
    try {
      await updateOpenStatus.mutateAsync({
        is_open: Boolean((restaurant as any)?.is_open),
        closed_message: closedMessageInput,
      });
      toast.success("Mensagem salva!");
    } catch {
      toast.error("Erro ao salvar mensagem.");
    } finally {
      setSavingShift(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
  const olderOrders = orders.filter(o => new Date(o.created_at) < today);

  // Filter trash: only show orders deleted within 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const validTrashOrders = trashOrders.filter(o => o.deleted_at && new Date(o.deleted_at) >= thirtyDaysAgo);

  const paymentLabels: Record<string, string> = {
    pix: "Pix",
    debito: "Débito",
    credito: "Crédito",
    dinheiro: "Dinheiro",
  };

  const handleSavePixSettings = () => {
    const parsed = pixSchema.safeParse({
      ...pixForm,
      pix_key: pixForm.pix_key || null,
      pix_recipient_name: pixForm.pix_recipient_name || null,
      pix_city: pixForm.pix_city || null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // Open confirmation dialog asking for the 6-digit Pix password
    setPixConfirmPassword("");
    setConfirmPixDialog(true);
  };

  const handleConfirmSavePix = async () => {
    if (!/^\d{6}$/.test(pixConfirmPassword)) {
      toast.error("Informe a senha do Pix (6 dígitos)");
      return;
    }
    const parsed = pixSchema.safeParse({
      ...pixForm,
      pix_key: pixForm.pix_key || null,
      pix_recipient_name: pixForm.pix_recipient_name || null,
      pix_city: pixForm.pix_city || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    try {
      await updatePixSettings.mutateAsync({
        password: pixConfirmPassword,
        settings: {
          pix_enabled: parsed.data.pix_enabled,
          pix_key_type: parsed.data.pix_enabled ? parsed.data.pix_key_type : null,
          pix_key: parsed.data.pix_enabled ? parsed.data.pix_key : null,
          pix_recipient_name: parsed.data.pix_enabled ? parsed.data.pix_recipient_name : null,
          pix_city: parsed.data.pix_enabled ? parsed.data.pix_city : null,
        },
      });
      toast.success("Configuração Pix salva!");
      setConfirmPixDialog(false);
      setPixConfirmPassword("");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Invalid password")) toast.error("Senha do Pix incorreta!");
      else if (msg.includes("not configured")) toast.error("Senha do Pix ainda não configurada. Redefina antes de salvar.");
      else toast.error("Erro ao salvar configuração Pix.");
    }
  };

  const handleVerifyPixAccountPassword = async () => {
    if (!user?.email) return;
    setVerifyingPix(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pixAccountPassword });
      if (error) {
        toast.error("Senha da conta incorreta!");
        return;
      }
      setResetPixStep("newpass");
    } catch {
      toast.error("Erro ao verificar senha.");
    } finally {
      setVerifyingPix(false);
    }
  };

  const handleResetPixPassword = async () => {
    try {
      await setPixPassword.mutateAsync(newPixPassword);
      toast.success("Senha do Pix redefinida com sucesso!");
      setResetPixDialog(false);
      setPixAccountPassword("");
      setNewPixPassword("");
      setResetPixStep("verify");
    } catch {
      toast.error("Erro ao redefinir senha.");
    }
  };

  const renderOrder = (order: typeof orders[0], isTrash = false) => {
    const isDelivery = order.order_type === "delivery";
    const mapsHref = order.delivery_maps_url
      || (order.delivery_lat && order.delivery_lng ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}` : null)
      || (order.delivery_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}` : null);

    return (
    <div key={order.id} className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{order.customer_name || "Cliente"}</p>
            <Badge variant={isDelivery ? "default" : "secondary"} className="text-[10px]">
              {isDelivery ? "🛵 Delivery" : `Mesa ${order.table_number || "—"}`}
            </Badge>
          </div>
          {!isDelivery && order.table_number && (
            <p className="text-sm font-medium text-primary">Mesa: {order.table_number}</p>
          )}
          {isDelivery && order.payment_method && (
            <p className="text-sm text-muted-foreground">Pagamento: <span className="font-medium text-foreground">{paymentLabels[order.payment_method] || order.payment_method}</span></p>
          )}
          {order.payment_method === "pix" && order.payment_status && (
            <Badge className={pixStatusLabels[order.payment_status]?.color}>{pixStatusLabels[order.payment_status]?.label}</Badge>
          )}
          {isDelivery && (order.delivery_address || mapsHref) && (
            <div className="text-sm text-muted-foreground">
              {order.delivery_address && <p className="whitespace-pre-line">📍 {order.delivery_address}</p>}
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1">
                  <ExternalLink className="h-3 w-3" /> Abrir no Maps
                </a>
              )}
            </div>
          )}
          {!isDelivery && order.customer_phone && <p className="text-sm text-muted-foreground">Obs: {order.customer_phone}</p>}
          {isDelivery && order.customer_phone && <p className="text-sm text-muted-foreground">Tel: {order.customer_phone}</p>}
          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
          {isTrash && order.deleted_at && (
            <p className="text-xs text-destructive">Excluído em: {new Date(order.deleted_at).toLocaleString("pt-BR")}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={`${statusLabels[order.status]?.color} ${order.status === "pending" ? "animate-blink-pending" : ""}`}>
            {statusLabels[order.status]?.label}
          </Badge>
          <span className="font-display font-bold text-lg">R$ {Number(order.total).toFixed(2)}</span>
          {order.tip_enabled && Number(order.tip_amount ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">
              inclui 10% garçom (R$ {Number(order.tip_amount).toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {!isTrash && (
        <>
          <div className="flex flex-wrap gap-2">
            {["pending", "preparing", "ready", "done", "cancelled"].map(s => (
              <Button
                key={s}
                size="sm"
                variant={order.status === s ? "default" : "outline"}
                onClick={() => {
                  updateOrderStatus.mutateAsync({ id: order.id, status: s });
                  if (s !== "preparing") {
                    setTimers(prev => {
                      const next = { ...prev };
                      delete next[order.id];
                      return next;
                    });
                  }
                }}
                className="text-xs"
              >
                {statusLabels[s].label}
              </Button>
            ))}
          </div>
          {order.payment_method === "pix" && order.payment_status !== "paid" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={async () => {
                await markOrderAsPaid.mutateAsync(order.id);
                toast.success("Pagamento marcado como pago!");
              }}
            >
              Marcar como pago
            </Button>
          )}
          {order.status === "preparing" && (
            <div className="flex items-center gap-2 flex-wrap">
              {!timers[order.id] ? (
                <>
                  <Timer className="h-4 w-4 text-info" />
                  <Input
                    type="number"
                    placeholder="Min"
                    className="w-20 h-8 text-xs"
                    value={timerInput[order.id] || ""}
                    onChange={e => setTimerInput(prev => ({ ...prev, [order.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => {
                      const mins = parseInt(timerInput[order.id] || "0");
                      if (mins > 0) {
                        setTimers(prev => ({ ...prev, [order.id]: { total: mins * 60, remaining: mins * 60 } }));
                      }
                    }}
                  >
                    Iniciar
                  </Button>
                </>
              ) : (
                <>
                  <Timer className={`h-4 w-4 ${timers[order.id].remaining === 0 ? "text-destructive animate-blink-pending" : "text-info"}`} />
                  <span className={`font-mono text-sm font-bold ${timers[order.id].remaining === 0 ? "text-destructive" : ""}`}>
                    {Math.floor(timers[order.id].remaining / 60).toString().padStart(2, "0")}:
                    {(timers[order.id].remaining % 60).toString().padStart(2, "0")}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8"
                    onClick={() => setTimers(prev => {
                      const next = { ...prev };
                      delete next[order.id];
                      return next;
                    })}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleExpandOrder(order.id)}>
          {expandedOrder === order.id ? "Ocultar itens" : "Ver itens"}
        </Button>
        {!isTrash && (
          <Button variant="ghost" size="sm" onClick={() => handleSoftDelete(order.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        )}
        {isTrash && (
          <>
            <Button variant="ghost" size="sm" onClick={() => handleRestore(order.id)} className="text-primary">
              <RotateCcw className="h-4 w-4 mr-1" /> Restaurar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setDeletePasswordDialog({ open: true, orderId: order.id });
                setDeletePassword("");
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir permanente
            </Button>
          </>
        )}
      </div>

      {expandedOrder === order.id && (
        <div className="border-t pt-2 space-y-1">
          {orderItems.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.product_name}</span>
              <span className="text-muted-foreground">R$ {(item.quantity * Number(item.price)).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };


  const tabs = [
    { id: "orders" as Tab, label: "Pedidos do dia", icon: ShoppingBag, count: todayOrders.filter(o => o.status === "pending").length },
    { id: "orders-old" as Tab, label: "Pedidos anteriores", icon: ShoppingBag, count: olderOrders.length || undefined },
    { id: "trash" as Tab, label: "Lixeira", icon: Trash2, count: validTrashOrders.length || undefined },
    { id: "tables" as Tab, label: "Mesas", icon: Armchair },
    { id: "waiters" as Tab, label: "Garçom", icon: Users },
    { id: "shift" as Tab, label: "Expediente", icon: Power },
    { id: "pix" as Tab, label: "Pix", icon: QrCode },
    { id: "products" as Tab, label: "Produtos", icon: Package },
    { id: "categories" as Tab, label: "Categorias", icon: FolderOpen },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-primary">🍔 {restaurant.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(menuUrl); toast.success("Link copiado!"); }}>
              <Copy className="h-4 w-4 mr-1" /> Link
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm"><QrCode className="h-4 w-4 mr-1" /> QR Code</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-center">QR Code do Cardápio</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="rounded-xl border bg-white p-4" id="qrcode-container">
                    <QRCodeSVG value={menuUrl} size={200} level="H" includeMargin />
                  </div>
                  <p className="text-sm text-muted-foreground text-center break-all">{menuUrl}</p>
                  <Button
                    onClick={() => {
                      const svg = document.querySelector("#qrcode-container svg");
                      if (!svg) return;
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement("canvas");
                      canvas.width = 256;
                      canvas.height = 256;
                      const ctx = canvas.getContext("2d");
                      const img = new Image();
                      img.onload = () => {
                        ctx?.drawImage(img, 0, 0, 256, 256);
                        const a = document.createElement("a");
                        a.download = `qrcode-${restaurant.slug}.png`;
                        a.href = canvas.toDataURL("image/png");
                        a.click();
                      };
                      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                    }}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-1" /> Baixar QR Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link to={`/cardapio/${restaurant.slug}`} target="_blank">
              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-card">
        <div className="container flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.count ? <Badge className="ml-1 h-5 px-1.5 text-xs">{t.count}</Badge> : null}
            </button>
          ))}
        </div>
      </div>

      <main className="container py-6 space-y-6">
        {/* ORDERS TODAY TAB */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold">Pedidos do dia — {new Date().toLocaleDateString("pt-BR")}</h2>
            {todayOrders.length === 0 && <p className="text-muted-foreground">Nenhum pedido hoje.</p>}
            <div className="space-y-3">
              {todayOrders.map(o => renderOrder(o))}
            </div>
          </div>
        )}

        {/* OLDER ORDERS TAB */}
        {activeTab === "orders-old" && (() => {
          const olderGrouped: Record<string, typeof orders> = {};
          olderOrders.forEach(o => {
            const key = new Date(o.created_at).toLocaleDateString("pt-BR");
            if (!olderGrouped[key]) olderGrouped[key] = [];
            olderGrouped[key].push(o);
          });
          return (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-bold">Pedidos anteriores</h2>
              {olderOrders.length === 0 && <p className="text-muted-foreground">Nenhum pedido anterior.</p>}
              {Object.entries(olderGrouped).map(([date, dateOrders]) => (
                <div key={date} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    📅 {date}
                    <Badge variant="outline" className="text-xs">{dateOrders.length}</Badge>
                  </h3>
                  {dateOrders.map(o => renderOrder(o))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* TRASH TAB */}
        {activeTab === "trash" && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold">🗑️ Lixeira</h2>
            <p className="text-sm text-muted-foreground">Pedidos excluídos ficam aqui por até 30 dias. Após isso, são removidos automaticamente.</p>
            <Button variant="outline" size="sm" onClick={() => { setResetTrashDialog(true); setResetStep("verify"); setAccountPassword(""); setNewTrashPassword(""); }}>
              🔑 Redefinir senha da lixeira
            </Button>
            {validTrashOrders.length === 0 && <p className="text-muted-foreground">Nenhum pedido na lixeira.</p>}
            <div className="space-y-3">
              {validTrashOrders.map(o => renderOrder(o, true))}
            </div>
          </div>
        )}

        {activeTab === "pix" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold">Configurações Pix</h2>
              <p className="text-sm text-muted-foreground">Configure a chave fixa usada para gerar o QR Code do cliente. Toda alteração exige a senha do Pix (6 dígitos).</p>
            </div>

            <Button variant="outline" size="sm" onClick={() => { setResetPixDialog(true); setResetPixStep("verify"); setPixAccountPassword(""); setNewPixPassword(""); }}>
              🔑 Redefinir senha do Pix
            </Button>

            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="font-medium">Aceitar Pix</p>
                  <p className="text-sm text-muted-foreground">Exibe QR Code e código copia e cola no checkout.</p>
                </div>
                <Switch checked={pixForm.pix_enabled} onCheckedChange={(value) => setPixForm((prev) => ({ ...prev, pix_enabled: value }))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo da chave</Label>
                  <select
                    value={pixForm.pix_key_type ?? ""}
                    onChange={(e) => setPixForm((prev) => ({ ...prev, pix_key_type: (e.target.value || null) as PixKeyType | null }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Selecione</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Chave aleatória</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Chave Pix</Label>
                  <Input value={pixForm.pix_key} onChange={(e) => setPixForm((prev) => ({ ...prev, pix_key: e.target.value }))} placeholder="Digite a chave Pix" maxLength={120} />
                </div>

                <div className="space-y-2">
                  <Label>Nome do recebedor</Label>
                  <Input value={pixForm.pix_recipient_name} onChange={(e) => setPixForm((prev) => ({ ...prev, pix_recipient_name: e.target.value }))} placeholder="Nome que aparece no Pix" maxLength={25} />
                </div>

                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={pixForm.pix_city} onChange={(e) => setPixForm((prev) => ({ ...prev, pix_city: e.target.value }))} placeholder="Ex: São Paulo" maxLength={15} />
                </div>
              </div>

              <Button onClick={handleSavePixSettings} disabled={updatePixSettings.isPending}>
                {updatePixSettings.isPending ? "Salvando..." : "Salvar configuração Pix"}
              </Button>
            </div>

            {/* Delivery payment methods */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">Formas de pagamento no Delivery</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha quais opções de pagamento aparecem para o cliente nos pedidos de delivery. Pelo menos uma deve ficar ativa.
                </p>
              </div>
              {(() => {
                const allMethods: { v: string; l: string }[] = [
                  { v: "pix", l: "Pix" },
                  { v: "debito", l: "Cartão de Débito" },
                  { v: "credito", l: "Cartão de Crédito" },
                  { v: "dinheiro", l: "Dinheiro" },
                ];
                const current: string[] = ((restaurant as any).delivery_payment_methods ?? ["pix","debito","credito","dinheiro"]) as string[];
                const toggle = async (v: string) => {
                  const next = current.includes(v) ? current.filter(x => x !== v) : [...current, v];
                  if (next.length === 0) {
                    toast.error("Mantenha pelo menos uma forma de pagamento ativa.");
                    return;
                  }
                  try {
                    await updateDeliveryPaymentMethods.mutateAsync(next);
                    toast.success("Formas de pagamento atualizadas.");
                  } catch (err: any) {
                    toast.error("Não foi possível atualizar as formas de pagamento.");
                  }
                };
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allMethods.map(m => {
                      const active = current.includes(m.v);
                      return (
                        <button
                          key={m.v}
                          type="button"
                          disabled={updateDeliveryPaymentMethods.isPending}
                          onClick={() => toggle(m.v)}
                          className={`text-left rounded-lg border p-3 transition-colors ${
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:bg-secondary"
                          }`}
                        >
                          <p className="font-medium text-sm">{m.l}</p>
                          <p className={`text-xs ${active ? "opacity-90" : "text-muted-foreground"}`}>
                            {active ? "Ativa" : "Desativada"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* WAITERS TAB */}
        {activeTab === "waiters" && <WaitersTab restaurantId={restaurant.id} restaurantSlug={restaurant.slug} />}

        {/* TABLES TAB */}
        {activeTab === "tables" && (
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold">Mesas do salão</h2>
              <p className="text-sm text-muted-foreground">
                Defina quantas mesas existem no seu local. As mesas serão numeradas de <strong>1</strong> até a quantidade informada.
                No cardápio, o cliente só poderá escolher mesas que não estão ocupadas.
              </p>
              <p className="text-sm text-muted-foreground">
                Uma mesa só fica disponível novamente quando você marcar o pedido como <strong>Finalizado</strong> ou <strong>Cancelado</strong> aqui no dashboard.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-count">Quantidade de mesas</Label>
                <Input
                  id="table-count"
                  type="number"
                  min={0}
                  max={500}
                  value={tableCountInput}
                  onChange={e => setTableCountInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ex: 12"
                />
              </div>
              <Button onClick={handleSaveTableCount} disabled={savingTableCount}>
                {savingTableCount ? "Salvando..." : "Salvar quantidade"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Atualmente configurado: <strong>{(restaurant as any).table_count ?? 0}</strong> mesa(s).
              </p>
            </div>
          </div>
        )}

        {/* SHIFT TAB */}
        {activeTab === "shift" && (
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold">Expediente da lanchonete</h2>
              <p className="text-sm text-muted-foreground">
                Quando o expediente estiver <strong>encerrado</strong>, o cardápio continua visível, mas os clientes não conseguem enviar pedidos. A mensagem abaixo será exibida para eles.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Status atual</p>
                  <p className="text-sm text-muted-foreground">
                    {(restaurant as any).is_open ? (
                      <span className="text-success font-semibold">Aberta — recebendo pedidos</span>
                    ) : (
                      <span className="text-destructive font-semibold">Fechada — pedidos bloqueados</span>
                    )}
                  </p>
                </div>
                <Switch
                  checked={Boolean((restaurant as any).is_open)}
                  disabled={savingShift}
                  onCheckedChange={(v) => handleToggleShift(v)}
                />
              </div>
            </div>

            {/* Service mode selector */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <p className="font-medium">Modo de atendimento</p>
                <p className="text-xs text-muted-foreground">
                  Escolha quais tipos de pedido sua lanchonete aceita no cardápio público.
                </p>
              </div>
              {(() => {
                const current = ((restaurant as any).service_mode ?? "both") as "both" | "delivery" | "table";
                const options: { value: "both" | "delivery" | "table"; label: string; desc: string }[] = [
                  { value: "both", label: "Mesas e Delivery", desc: "Aceita os dois tipos de pedido." },
                  { value: "table", label: "Somente Mesas", desc: "Bloqueia pedidos de delivery." },
                  { value: "delivery", label: "Somente Delivery", desc: "Bloqueia pedidos de mesa." },
                ];
                return (
                  <div className="grid gap-2">
                    {options.map((opt) => {
                      const selected = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={updateServiceMode.isPending || selected}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              await updateServiceMode.mutateAsync(opt.value);
                              toast.success("Modo de atendimento atualizado.");
                            } catch (err: any) {
                              toast.error(err?.message || "Falha ao atualizar modo de atendimento.");
                            }
                          }}
                          className={`text-left rounded-lg border p-3 transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-input hover:bg-secondary"
                          }`}
                        >
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className={`text-xs ${selected ? "opacity-90" : "text-muted-foreground"}`}>{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="closed-message">Mensagem exibida quando estiver fechada</Label>
                <Textarea
                  id="closed-message"
                  value={closedMessageInput}
                  onChange={(e) => setClosedMessageInput(e.target.value.slice(0, 300))}
                  placeholder="Ex: Estamos fechados. Voltamos amanhã às 18h!"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{closedMessageInput.length}/300</p>
              </div>
              <Button onClick={handleSaveClosedMessage} disabled={savingShift}>
                {savingShift ? "Salvando..." : "Salvar mensagem"}
              </Button>
            </div>

            <Dialog open={closeShiftDialog} onOpenChange={(o) => !savingShift && setCloseShiftDialog(o)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Encerrar expediente</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  O que deseja fazer com os pedidos pendentes (Pendente, Em preparo, Pronto)?
                </p>
                <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    disabled={savingShift}
                    onClick={() => handleConfirmCloseShift(false)}
                  >
                    Manter pedidos em andamento
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={savingShift}
                    onClick={() => handleConfirmCloseShift(true)}
                  >
                    Cancelar todos os pedidos pendentes
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={savingShift}
                    onClick={() => setCloseShiftDialog(false)}
                  >
                    Voltar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold">Categorias</h2>
            <div className="flex gap-2">
              <Input placeholder="Nova categoria..." value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} />
              <Button onClick={handleAddCategory}><Plus className="h-4 w-4" /></Button>
            </div>
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                {editingCat === cat.id ? (
                  <div className="flex gap-2 flex-1">
                    <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleUpdateCategory(cat.id)} />
                    <Button size="sm" onClick={() => handleUpdateCategory(cat.id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{cat.name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Produtos</h2>
              <Button onClick={() => { resetProductForm(); setShowProductForm(true); }}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
            </div>

            {showProductForm && (
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <h3 className="font-semibold">{editingProduct ? "Editar Produto" : "Novo Produto"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} placeholder="X-Burger" />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))} placeholder="19.90" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <select
                      value={productForm.category_id}
                      onChange={e => setProductForm(p => ({ ...p, category_id: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Selecione</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem</Label>
                    <Input type="file" accept="image/*" onChange={e => setProductImage(e.target.files?.[0] || null)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} placeholder="Pão, carne, queijo..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={productForm.is_available} onCheckedChange={v => setProductForm(p => ({ ...p, is_available: v }))} />
                    <Label>Disponível</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={productForm.is_promo} onCheckedChange={v => setProductForm(p => ({ ...p, is_promo: v }))} />
                    <Label>Em promoção</Label>
                  </div>
                  {productForm.is_promo && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Preço promocional (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productForm.promo_price}
                        onChange={e => setProductForm(p => ({ ...p, promo_price: e.target.value }))}
                        placeholder="14.90"
                      />
                      <p className="text-xs text-muted-foreground">Deve ser menor que o preço original. O preço antigo aparecerá riscado no cardápio.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={productForm.track_stock} onCheckedChange={v => setProductForm(p => ({ ...p, track_stock: v }))} />
                    <Label>Controlar estoque</Label>
                  </div>
                  {productForm.track_stock && (
                    <div className="space-y-2">
                      <Label>Quantidade disponível</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={productForm.stock_quantity}
                        onChange={e => setProductForm(p => ({ ...p, stock_quantity: e.target.value }))}
                        placeholder="Ex: 20"
                      />
                      <p className="text-xs text-muted-foreground">O cliente não vê a quantidade. O item some do cardápio quando chegar a zero.</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProduct} disabled={savingProduct}>{savingProduct ? "Salvando..." : "Salvar"}</Button>
                  <Button variant="ghost" onClick={resetProductForm}>Cancelar</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(p => (
                <div key={p.id} className={`rounded-xl border bg-card overflow-hidden ${!p.is_available ? "opacity-60" : ""}`}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{p.name}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      </div>
                      {p.is_promo && p.promo_price != null ? (
                        <div className="flex flex-col items-end whitespace-nowrap">
                          <span className="text-xs text-muted-foreground line-through">R$ {Number(p.price).toFixed(2)}</span>
                          <span className="font-display font-bold text-primary">R$ {Number(p.promo_price).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="font-display font-bold text-primary whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={p.is_available ? "default" : "secondary"}>{p.is_available ? "Disponível" : "Indisponível"}</Badge>
                        {p.track_stock && (
                          <Badge variant={p.stock_quantity > 0 ? "outline" : "destructive"}>
                            {p.stock_quantity > 0 ? `${p.stock_quantity} em estoque` : "Sem estoque"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEditProduct(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Excluir produto?")) { await deleteProduct.mutateAsync(p.id); toast.success("Excluído!"); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updateProduct.mutateAsync({ id: p.id, is_available: !p.is_available })}>
                          <Switch checked={p.is_available} className="pointer-events-none" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Password dialog for permanent delete */}
      <Dialog open={deletePasswordDialog.open} onOpenChange={open => { if (!open) { setDeletePasswordDialog({ open: false, orderId: null }); setDeletePassword(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão permanente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Digite a senha da lixeira (4 dígitos) para excluir permanentemente.</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="****"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeletePasswordDialog({ open: false, orderId: null }); setDeletePassword(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={deletePassword.length !== 4}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset trash password dialog */}
      <Dialog open={resetTrashDialog} onOpenChange={open => { if (!open) { setResetTrashDialog(false); setResetStep("verify"); setAccountPassword(""); setNewTrashPassword(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Redefinir senha da lixeira</DialogTitle>
          </DialogHeader>
          {resetStep === "verify" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Para sua segurança, confirme a senha da sua conta.</p>
              <Input
                type="password"
                placeholder="Senha da conta"
                value={accountPassword}
                onChange={e => setAccountPassword(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetTrashDialog(false)}>Cancelar</Button>
                <Button onClick={handleVerifyAccountPassword} disabled={!accountPassword || verifying}>
                  {verifying ? "Verificando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Digite a nova senha da lixeira (4 dígitos numéricos).</p>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                value={newTrashPassword}
                onChange={e => setNewTrashPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-lg tracking-widest"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetTrashDialog(false)}>Cancelar</Button>
                <Button onClick={handleResetTrashPassword} disabled={newTrashPassword.length !== 4}>Salvar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Pix change dialog (current 6-digit PIN) */}
      <Dialog open={confirmPixDialog} onOpenChange={open => { if (!open) { setConfirmPixDialog(false); setPixConfirmPassword(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Confirmar alteração do Pix</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Digite a senha do Pix (6 dígitos) para confirmar a alteração.</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="******"
              value={pixConfirmPassword}
              onChange={e => setPixConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg tracking-widest"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmPixDialog(false)}>Cancelar</Button>
              <Button onClick={handleConfirmSavePix} disabled={pixConfirmPassword.length !== 6 || updatePixSettings.isPending}>
                {updatePixSettings.isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Pix password dialog */}
      <Dialog open={resetPixDialog} onOpenChange={open => { if (!open) { setResetPixDialog(false); setResetPixStep("verify"); setPixAccountPassword(""); setNewPixPassword(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Redefinir senha do Pix</DialogTitle>
          </DialogHeader>
          {resetPixStep === "verify" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Para sua segurança, confirme a senha da sua conta.</p>
              <Input
                type="password"
                placeholder="Senha da conta"
                value={pixAccountPassword}
                onChange={e => setPixAccountPassword(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetPixDialog(false)}>Cancelar</Button>
                <Button onClick={handleVerifyPixAccountPassword} disabled={!pixAccountPassword || verifyingPix}>
                  {verifyingPix ? "Verificando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Digite a nova senha do Pix (6 dígitos numéricos).</p>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="******"
                value={newPixPassword}
                onChange={e => setNewPixPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetPixDialog(false)}>Cancelar</Button>
                <Button onClick={handleResetPixPassword} disabled={newPixPassword.length !== 6 || setPixPassword.isPending}>
                  {setPixPassword.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
