import { supabase } from "@/integrations/supabase/client";

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uploadProductImage(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${restaurantId}/${Date.now()}.${ext}`;
  
  const { error } = await supabase.storage
    .from("product-images")
    .upload(fileName, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
