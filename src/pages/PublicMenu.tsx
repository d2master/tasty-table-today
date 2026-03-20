import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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
  image_url: string | null;
  is_available: boolean;
  category_id: string;
}

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
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
      if (!rest) { setNotFound(true); setLoading(false); return; }
      setRestaurant(rest);

      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
        supabase.from("products").select("*").eq("restaurant_id", rest.id).eq("is_available", true).order("sort_order"),
      ]);

      setCategories(catRes.data ?? []);
      setProducts(prodRes.data as Product[] ?? []);
      if (catRes.data?.length) setActiveCategory(catRes.data[0].id);
      setLoading(false);
    })();
  }, [slug]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * Number(c.product.price), 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleSubmitOrder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tableNumber.trim()) {
      toast.error("Informe o número da mesa");
      return;
    }
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    setSubmitting(true);

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant!.id,
          customer_name: customerName.trim() || "Cliente",
          table_number: tableNumber.trim(),
          customer_phone: observation.trim() || null,
          status: "pending",
          total: cartTotal,
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order insert error:", orderError);
        toast.error("Erro ao enviar pedido: " + orderError.message);
        setSubmitting(false);
        return;
      }

    const items = cart.map(c => ({
      order_id: order.id,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.quantity,
      price: Number(c.product.price),
    }));

      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) {
        console.error("Items insert error:", itemsError);
        toast.error("Erro ao salvar itens: " + itemsError.message);
        setSubmitting(false);
        return;
      }

      toast.success("Pedido enviado com sucesso! 🎉");
      setCart([]);
      setShowCart(false);
      setCustomerName("");
      setTableNumber("");
      setObservation("");
    } catch (err: any) {
      console.error("Unexpected order error:", err);
      toast.error("Erro inesperado ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando cardápio...</div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lanchonete não encontrada</div>;

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
            return (
              <motion.div
                key={product.id}
                className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="w-full h-44 object-cover" />
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold">{product.name}</h3>
                  {product.description && <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-display font-bold text-lg text-primary">R$ {Number(product.price).toFixed(2)}</span>
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

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t shadow-lg z-50">
          <Button className="w-full gap-2" size="lg" onClick={() => setShowCart(true)}>
            <ShoppingCart className="h-5 w-5" />
            Ver Carrinho ({cartCount}) — R$ {cartTotal.toFixed(2)}
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-foreground/40" onClick={() => !submitting && setShowCart(false)} />
            <motion.div
              className="relative w-full max-w-lg bg-card rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Seu Pedido</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowCart(false)}><X className="h-5 w-5" /></Button>
              </div>

              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">R$ {Number(item.product.price).toFixed(2)} un.</p>
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

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Seu nome</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="João da Silva (opcional)" />
                </div>
                <div className="space-y-1">
                  <Label>Número da mesa <span className="text-destructive">*</span></Label>
                  <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Ex: 5" />
                </div>
                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Input value={observation} onChange={e => setObservation(e.target.value)} placeholder="Sem cebola, bem passado... (opcional)" />
                </div>
              </div>

              <Button className="w-full gap-2" size="lg" onClick={handleSubmitOrder} disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? "Enviando..." : "Finalizar Pedido"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
