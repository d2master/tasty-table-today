import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useRestaurant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createRestaurant = useMutation({
    mutationFn: async ({ name, slug, description }: { name: string; slug: string; description?: string }) => {
      const { data, error } = await supabase
        .from("restaurants")
        .insert({ name, slug, description, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
  });

  return { restaurant: restaurantQuery.data, isLoading: restaurantQuery.isLoading, createRestaurant };
}
