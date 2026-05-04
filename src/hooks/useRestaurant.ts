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
      const { data: base, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, description, logo_url, is_blocked, table_count, pix_enabled, pix_recipient_name, pix_city, created_at, updated_at, owner_id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!base) return null;

      const { data: sensitive } = await supabase.rpc("get_my_restaurant_sensitive");
      const s = Array.isArray(sensitive) ? sensitive.find((r: any) => r.id === base.id) : null;

      return {
        ...base,
        trash_password: s?.trash_password ?? null,
        pix_key: s?.pix_key ?? null,
        pix_key_type: (s?.pix_key_type as PixKeyType | null) ?? null,
        pix_password: s?.pix_password ?? null,
      };
    },
    enabled: !!user,
  });

  const updateTableCount = useMutation({
    mutationFn: async (count: number) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ table_count: count })
        .eq("id", restaurantQuery.data!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
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

  // Update Pix settings ONLY by providing the 6-digit pix_password (server-side check)
  const updatePixSettings = useMutation({
    mutationFn: async ({ password, settings }: { password: string; settings: RestaurantPixSettings }) => {
      const { error } = await supabase.rpc("update_pix_settings_with_password", {
        _password: password,
        _pix_enabled: settings.pix_enabled,
        _pix_key: settings.pix_key,
        _pix_key_type: settings.pix_key_type,
        _pix_recipient_name: settings.pix_recipient_name,
        _pix_city: settings.pix_city,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
  });

  // Set / reset the 6-digit Pix password (server-side validates format)
  const setPixPassword = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.rpc("set_pix_password", { _new_password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
  });

  return {
    restaurant: restaurantQuery.data,
    isLoading: restaurantQuery.isLoading,
    createRestaurant,
    updateTrashPassword,
    updatePixSettings,
    setPixPassword,
  };
}
