import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories(restaurantId: string | undefined) {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const createCategory = useMutation({
    mutationFn: async ({ name, sort_order }: { name: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, restaurant_id: restaurantId!, sort_order: sort_order ?? 0 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", restaurantId] }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", restaurantId] }),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", restaurantId] }),
  });

  return { categories: categoriesQuery.data ?? [], isLoading: categoriesQuery.isLoading, createCategory, updateCategory, deleteCategory };
}
