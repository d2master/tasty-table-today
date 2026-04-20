import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface RestaurantPixSettings {
  pix_enabled: boolean;
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  pix_recipient_name: string | null;
  pix_city: string | null;
}

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

  const updateTrashPassword = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ trash_password: newPassword })
        .eq("id", restaurantQuery.data!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
  });

  const updatePixSettings = useMutation({
    mutationFn: async (settings: RestaurantPixSettings) => {
      const { error } = await supabase
        .from("restaurants")
        .update(settings as never)
        .eq("id", restaurantQuery.data!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
  });

  return { restaurant: restaurantQuery.data, isLoading: restaurantQuery.isLoading, createRestaurant, updateTrashPassword, updatePixSettings };
}
