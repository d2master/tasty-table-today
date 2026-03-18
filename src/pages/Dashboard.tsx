import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { uploadProductImage } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, Plus, Pencil, Trash2, ExternalLink, Package, FolderOpen, ShoppingBag, Copy, QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { OrderItem } from "@/hooks/useOrders";

type Tab = "categories" | "products" | "orders";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-warning text-warning-foreground" },
  preparing: { label: "Em Preparo", color: "bg-info text-info-foreground" },
  done: { label: "Finalizado", color: "bg-success text-success-foreground" },
  cancelled: { label: "Cancelado", color: "bg-destructive text-destructive-foreground" },
};

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { restaurant, isLoading: restLoading } = useRestaurant();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories(restaurant?.id);
  const { products, createProduct, updateProduct, deleteProduct } = useProducts(restaurant?.id);
  const { orders, updateOrderStatus, getOrderItems } = useOrders(restaurant?.id);

  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", category_id: "", is_available: true });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Order items expand
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  if (authLoading || restLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!restaurant) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Nenhuma lanchonete encontrada.</div>;
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
    setProductForm({ name: "", description: "", price: "", category_id: "", is_available: true });
    setProductImage(null);
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.category_id || !productForm.price) {
      toast.error("Preencha nome, categoria e preço");
      return;
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
          category_id: productForm.category_id,
          is_available: productForm.is_available,
          ...(image_url ? { image_url } : {}),
        });
        toast.success("Produto atualizado!");
      } else {
        await createProduct.mutateAsync({
          name: productForm.name,
          description: productForm.description || null,
          price: parseFloat(productForm.price),
          category_id: productForm.category_id,
          is_available: productForm.is_available,
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
      category_id: p.category_id,
      is_available: p.is_available,
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

  const tabs = [
    { id: "orders" as Tab, label: "Pedidos", icon: ShoppingBag, count: orders.filter(o => o.status === "pending").length },
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
        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold">Pedidos</h2>
            {orders.length === 0 && <p className="text-muted-foreground">Nenhum pedido ainda.</p>}
            {orders.map(order => (
              <div key={order.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusLabels[order.status]?.color}>{statusLabels[order.status]?.label}</Badge>
                    <span className="font-display font-bold text-lg">R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["pending", "preparing", "done", "cancelled"].map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={order.status === s ? "default" : "outline"}
                      onClick={() => updateOrderStatus.mutateAsync({ id: order.id, status: s })}
                      className="text-xs"
                    >
                      {statusLabels[s].label}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleExpandOrder(order.id)}>
                  {expandedOrder === order.id ? "Ocultar itens" : "Ver itens"}
                </Button>
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
            ))}
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
                    <Select value={productForm.category_id} onValueChange={v => setProductForm(p => ({ ...p, category_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                      <span className="font-display font-bold text-primary whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant={p.is_available ? "default" : "secondary"}>{p.is_available ? "Disponível" : "Indisponível"}</Badge>
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
    </div>
  );
}
