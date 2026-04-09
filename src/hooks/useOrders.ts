import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Order {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string | null;
  table_number: string;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export function useOrders(restaurantId: string | undefined) {
  const queryClient = useQueryClient();

  // Active orders (not deleted)
  const ordersQuery = useQuery({
    queryKey: ["orders", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!restaurantId,
  });

  // Trash orders
  const trashQuery = useQuery({
    queryKey: ["orders-trash", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!restaurantId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
        queryClient.invalidateQueries({ queryKey: ["orders-trash", restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] }),
  });

  const softDeleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["orders-trash", restaurantId] });
    },
  });

  const restoreOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["orders-trash", restaurantId] });
    },
  });

  const permanentDeleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-trash", restaurantId] });
    },
  });

  const getOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);
    if (error) throw error;
    return data as OrderItem[];
  };

  return {
    orders: ordersQuery.data ?? [],
    trashOrders: trashQuery.data ?? [],
    isLoading: ordersQuery.isLoading,
    updateOrderStatus,
    softDeleteOrder,
    restoreOrder,
    permanentDeleteOrder,
    getOrderItems,
  };
}
