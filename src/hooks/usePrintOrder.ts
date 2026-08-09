import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { printReceipt, type ReceiptItem } from "@/lib/printReceipt";
import type { Order } from "@/hooks/useOrders";

interface Options {
  restaurantName: string;
  restaurantPhone?: string | null;
}

export function usePrintOrder({ restaurantName, restaurantPhone }: Options) {
  const waiterCache = useRef<Record<string, string>>({});

  const printOrder = useCallback(
    async (order: Order) => {
      let items: ReceiptItem[] = [];
      try {
        const { data } = await supabase
          .from("order_items")
          .select("product_name, quantity, price")
          .eq("order_id", order.id);
        items = (data ?? []) as ReceiptItem[];
      } catch (e) {
        console.error("Falha ao carregar itens para impressão", e);
      }

      let waiterName: string | null = null;
      const waiterId = (order as unknown as { waiter_id?: string | null }).waiter_id;
      if (waiterId) {
        if (waiterCache.current[waiterId]) {
          waiterName = waiterCache.current[waiterId];
        } else {
          const { data } = await supabase.from("waiters").select("name").eq("id", waiterId).maybeSingle();
          if (data?.name) {
            waiterCache.current[waiterId] = data.name;
            waiterName = data.name;
          }
        }
      }

      printReceipt({
        restaurantName,
        restaurantPhone,
        orderId: order.id,
        createdAt: order.created_at,
        orderType: order.order_type ?? "table",
        tableNumber: order.table_number,
        waiterName,
        customerName: order.customer_name,
        customerPhone: order.order_type === "delivery" ? order.customer_phone : null,
        observation:
          (order as unknown as { observation?: string | null }).observation ||
          (order.order_type === "delivery" ? null : order.customer_phone) ||
          null,
        items,
        tipEnabled: order.tip_enabled,
        tipAmount: Number(order.tip_amount ?? 0),
        total: Number(order.total),
        paymentMethod: order.payment_method ?? null,
        paymentStatus: order.payment_status ?? null,
        deliveryAddress: order.delivery_address ?? null,
        deliveryMapsUrl: order.delivery_maps_url ?? null,
      });
    },
    [restaurantName, restaurantPhone],
  );

  return { printOrder };
}
