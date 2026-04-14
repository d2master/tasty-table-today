import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlockedCustomer {
  id: string;
  restaurant_id: string;
  customer_phone: string;
  reason: string;
  blocked_at: string;
}

export function useBlockedCustomers(restaurantId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["blocked-customers", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_customers")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("blocked_at", { ascending: false });
      if (error) throw error;
      return data as BlockedCustomer[];
    },
    enabled: !!restaurantId,
  });

  const blockCustomer = useMutation({
    mutationFn: async ({ phone, reason }: { phone: string; reason?: string }) => {
      const { error } = await supabase.from("blocked_customers").insert({
        restaurant_id: restaurantId!,
        customer_phone: phone,
        reason: reason || "",
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-customers", restaurantId] }),
  });

  const unblockCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-customers", restaurantId] }),
  });

  return {
    blockedCustomers: query.data ?? [],
    isLoading: query.isLoading,
    blockCustomer,
    unblockCustomer,
  };
}
